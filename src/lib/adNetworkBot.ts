import { supabaseAdmin } from "@/lib/supabase";
import type { BotTemplate } from "@/lib/botTemplates";
import { tgAnswerCallback, tgSend, tgIsChannelMember } from "@/lib/tgApi";
import {
  upsertMember,
  sendMenu,
  depositLink,
  logPointsTx,
  maybeApplyReferral,
  tryHandleWithdrawal,
  type HostedBot,
  type TgUser,
} from "@/lib/botEngine";

/**
 * ad-network: a real, two-sided self-serve task marketplace (owner
 * clarified 2026-08-29 that this — not the earlier admin-curated
 * ad-campaign template — is what "بوت الإعلانات" actually means: any
 * member can fund and launch their own campaign, and any member can
 * complete available tasks to earn withdrawable points).
 *
 * Task types and how completion is verified:
 * - channel_join: real check via Telegram getChatMember (tgIsChannelMember).
 * - bot_join: no Bot API can confirm someone started another bot, so proof
 *   is a forwarded message — if the target bot sends the member anything
 *   and they forward it here, Telegram tells us the forward's origin bot.
 * - link_visit: honesty-based confirmation, same as the original ad-claim
 *   flow elsewhere in this codebase — there's no way to verify a website
 *   visit without an external tracking pixel/redirect service.
 *
 * Campaign creation is a short multi-step conversation. This codebase has
 * no in-memory per-user state, so bot_members.pending_action (jsonb) is
 * the state: each step writes what it's waiting for next, and the next
 * plain-text message consumes and clears it.
 */

type TaskType = "channel_join" | "bot_join" | "link_visit";
type PendingAction =
  | { step: "awaiting_target"; taskType: TaskType }
  | { step: "awaiting_reward"; taskType: TaskType; target: string }
  | { step: "awaiting_slots"; taskType: TaskType; target: string; reward: number };

const TASK_TYPE_LABEL: Record<string, string> = {
  channel_join: "📢 انضمام لقناة/مجموعة",
  bot_join: "🤖 تشغيل بوت",
  link_visit: "🔗 زيارة رابط",
};

const KNOWN_BUTTONS = ["أعلن", "المهام", "حملاتي", "الرصيد", "سحب", "الإحالات", "الأسئلة الشائعة"];

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "");
}

async function setPendingAction(bot: HostedBot, user: TgUser, action: PendingAction | null) {
  await supabaseAdmin()
    .from("bot_members")
    .update({ pending_action: action })
    .eq("bot_id", bot.id)
    .eq("tg_user_id", String(user.id));
}

export async function handleAdNetworkUpdate(bot: HostedBot, template: BotTemplate, update: any) {
  const db = supabaseAdmin();

  if (update.callback_query) {
    const cq = update.callback_query;
    const user: TgUser = cq.from;
    const chatId = cq.message?.chat?.id ?? user.id;
    await tgAnswerCallback(bot.bot_token, cq.id);
    const member = await upsertMember(bot.id, user);
    const data = String(cq.data || "");

    if (data.startsWith("adtype:")) {
      const taskType = data.slice(7) as TaskType;
      await setPendingAction(bot, user, { step: "awaiting_target", taskType });
      const prompt =
        taskType === "channel_join"
          ? "أرسل يوزر أو رابط قناتك/مجموعتك العام (مثال: @mychannel)"
          : taskType === "bot_join"
            ? "أرسل يوزر البوت الذي تريد الترويج له (مثال: @otherbot)"
            : "أرسل الرابط الذي تريد أن يزوره المستخدمون";
      await tgSend(bot.bot_token, chatId, prompt);
      return;
    }

    if (data.startsWith("taskdone:")) {
      const taskId = data.slice(9);
      const { data: task } = await db.from("ad_tasks").select("*").eq("id", taskId).eq("bot_id", bot.id).maybeSingle();
      if (!task || task.status !== "active" || task.slots_remaining <= 0) {
        await sendMenu(bot, template, chatId, "هذه المهمة لم تعد متاحة.");
        return;
      }
      if (task.advertiser_tg_user_id === String(user.id)) {
        await sendMenu(bot, template, chatId, "لا يمكنك إتمام حملتك الخاصة.");
        return;
      }
      if (task.task_type === "channel_join") {
        const isMember = await tgIsChannelMember(bot.bot_token, task.target, user.id);
        if (!isMember) {
          await sendMenu(bot, template, chatId, `لم يتم التحقق من انضمامك بعد إلى @${task.target}. انضم ثم أعد المحاولة.`);
          return;
        }
      }
      await completeTask(bot, template, task, user, chatId, member);
      return;
    }

    return;
  }

  const msg = update.message;
  if (!msg?.from || !msg.chat) return;
  const user: TgUser = msg.from;
  const chatId = msg.chat.id;
  const member = await upsertMember(bot.id, user);

  // Proof of "joined a bot": Telegram tells us when a message is forwarded
  // and, if the original sender was a bot, who that bot is — no other way
  // to confirm this from our side.
  const forwardOrigin = msg.forward_origin?.type === "user" ? msg.forward_origin.sender_user : msg.forward_from;
  if (forwardOrigin?.is_bot && forwardOrigin?.username) {
    const botUsername = String(forwardOrigin.username).toLowerCase();
    const { data: task } = await db
      .from("ad_tasks")
      .select("*")
      .eq("bot_id", bot.id)
      .eq("task_type", "bot_join")
      .eq("status", "active")
      .ilike("target", botUsername)
      .gt("slots_remaining", 0)
      .neq("advertiser_tg_user_id", String(user.id))
      .maybeSingle();
    if (task) {
      await completeTask(bot, template, task, user, chatId, member);
      return;
    }
  }

  const text = String(msg.text || "").trim();
  if (!text) return;

  if (text.startsWith("/start")) {
    const payload = text.slice(6).trim();
    if (payload) await maybeApplyReferral(bot, member, user, payload);
    await sendMenu(bot, template, chatId, bot.welcome_text || template.defaults.welcome);
    return;
  }

  // Button presses and known commands always reset any in-progress campaign
  // creation — a stuck flow should never trap a user who just wants a menu.
  const isKnownCommand = KNOWN_BUTTONS.includes(text) || text === "سحب" || text.startsWith("سحب:");
  if (isKnownCommand && member.pending_action) {
    await setPendingAction(bot, user, null);
    member.pending_action = null;
  }

  if (text === "الرصيد") {
    const points = Number(member.points || 0);
    await sendMenu(
      bot,
      template,
      chatId,
      `رصيدك: ${points} ${template.defaults.currencyName}\n\nشراء نقاط عبر الموقع (بعد مراجعة المالك):\n${depositLink(bot, user.id)}\n\nللسحب اضغط زر «سحب».`
    );
    return;
  }

  if (text === "سحب" || text.startsWith("سحب:")) {
    await tryHandleWithdrawal(bot, template, member, user, chatId, text);
    return;
  }

  if (text === "الإحالات") {
    const uname = bot.config?.botUsername || "";
    const handle = uname ? String(uname).replace(/^@/, "") : "bot";
    await sendMenu(bot, template, chatId, `رابط الإحالة:\nhttps://t.me/${handle}?start=${bot.public_code}_${user.id}`);
    return;
  }

  if (text === "الأسئلة الشائعة") {
    await sendMenu(bot, template, chatId, bot.config?.faq || template.defaults.faq);
    return;
  }

  if (text === "أعلن") {
    const inline = {
      inline_keyboard: [
        [{ text: TASK_TYPE_LABEL.channel_join, callback_data: "adtype:channel_join" }],
        [{ text: TASK_TYPE_LABEL.bot_join, callback_data: "adtype:bot_join" }],
        [{ text: TASK_TYPE_LABEL.link_visit, callback_data: "adtype:link_visit" }],
      ],
    };
    await tgSend(bot.bot_token, chatId, "ما الذي تريد الترويج له؟", { reply_markup: inline });
    return;
  }

  if (text === "حملاتي") {
    const { data: tasks } = await db
      .from("ad_tasks")
      .select("task_type, target, reward_points, slots_total, slots_remaining, status, created_at")
      .eq("bot_id", bot.id)
      .eq("advertiser_tg_user_id", String(user.id))
      .order("created_at", { ascending: false })
      .limit(10);
    if (!tasks || tasks.length === 0) {
      await sendMenu(bot, template, chatId, "لا حملات لك بعد. أنشئ واحدة من «أعلن».");
      return;
    }
    const statusAr: Record<string, string> = {
      pending: "بانتظار مراجعة المالك",
      active: "نشطة",
      paused: "متوقفة",
      exhausted: "اكتملت",
      rejected: "مرفوضة",
    };
    const list = tasks
      .map((t) => `• ${TASK_TYPE_LABEL[t.task_type] || t.task_type} ${t.target} — ${t.slots_remaining}/${t.slots_total} متبقٍ — ${statusAr[t.status] || t.status}`)
      .join("\n");
    await sendMenu(bot, template, chatId, `حملاتك:\n${list}`);
    return;
  }

  if (text === "المهام") {
    const { data: tasks } = await db
      .from("ad_tasks")
      .select("id, task_type, target, reward_points")
      .eq("bot_id", bot.id)
      .eq("status", "active")
      .gt("slots_remaining", 0)
      .neq("advertiser_tg_user_id", String(user.id))
      .order("created_at", { ascending: false })
      .limit(10);
    if (!tasks || tasks.length === 0) {
      await sendMenu(bot, template, chatId, "لا مهام متاحة حالياً. عد لاحقاً.");
      return;
    }
    for (const t of tasks) {
      if (t.task_type === "channel_join") {
        await tgSend(bot.bot_token, chatId, `${TASK_TYPE_LABEL.channel_join}: @${t.target}\nالمكافأة: ${t.reward_points} ${template.defaults.currencyName}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "افتح القناة", url: `https://t.me/${t.target}` }],
              [{ text: "تحققت من الانضمام ✅", callback_data: `taskdone:${t.id}` }],
            ],
          },
        });
      } else if (t.task_type === "bot_join") {
        await tgSend(
          bot.bot_token,
          chatId,
          `${TASK_TYPE_LABEL.bot_join}: @${t.target}\nالمكافأة: ${t.reward_points} ${template.defaults.currencyName}\n\nافتح البوت واضغط بدء، ثم أعد توجيه أي رسالة يرسلها لك إلى هنا لإثبات التشغيل وتُضاف نقاطك تلقائياً.`,
          { reply_markup: { inline_keyboard: [[{ text: "افتح البوت", url: `https://t.me/${t.target}` }]] } }
        );
      } else {
        await tgSend(bot.bot_token, chatId, `${TASK_TYPE_LABEL.link_visit}\nالمكافأة: ${t.reward_points} ${template.defaults.currencyName}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "فتح الرابط", url: t.target }],
              [{ text: "تأكيد المشاهدة ✅", callback_data: `taskdone:${t.id}` }],
            ],
          },
        });
      }
    }
    return;
  }

  // Campaign-creation flow — consumes bot_members.pending_action.
  const pending = member.pending_action as PendingAction | null;
  if (pending?.step === "awaiting_target") {
    const raw = text.trim();
    const target = pending.taskType === "link_visit" ? raw : normalizeHandle(raw);
    if (!target || (pending.taskType !== "link_visit" && !/^[A-Za-z0-9_]{3,}$/.test(target))) {
      await sendMenu(bot, template, chatId, "قيمة غير صالحة. أعد الإرسال بصيغة صحيحة.");
      return;
    }
    await setPendingAction(bot, user, { step: "awaiting_reward", taskType: pending.taskType, target });
    await tgSend(bot.bot_token, chatId, "كم نقطة تمنح لكل مستخدم ينفّذ المهمة؟ أرسل رقماً (مثال: 5)");
    return;
  }
  if (pending?.step === "awaiting_reward") {
    const reward = Number(text.trim());
    if (!Number.isFinite(reward) || reward <= 0) {
      await sendMenu(bot, template, chatId, "أرسل رقماً صحيحاً أكبر من صفر.");
      return;
    }
    await setPendingAction(bot, user, { step: "awaiting_slots", taskType: pending.taskType, target: pending.target, reward });
    await tgSend(
      bot.bot_token,
      chatId,
      `كم عدد المستخدمين المستهدفين؟ التكلفة الإجمالية = العدد × ${reward} تُخصم من رصيدك فور التأكيد. أرسل رقماً (مثال: 50)`
    );
    return;
  }
  if (pending?.step === "awaiting_slots") {
    const slots = Number(text.trim());
    if (!Number.isFinite(slots) || slots <= 0 || !Number.isInteger(slots)) {
      await sendMenu(bot, template, chatId, "أرسل عدداً صحيحاً أكبر من صفر.");
      return;
    }
    const total = pending.reward * slots;
    const points = Number(member.points || 0);
    if (total > points) {
      await sendMenu(
        bot,
        template,
        chatId,
        `التكلفة ${total} أكبر من رصيدك (${points}). أرسل عدداً أقل، أو أودع رصيداً أولاً:\n${depositLink(bot, user.id)}`
      );
      return;
    }
    const { error: insertError } = await db.from("ad_tasks").insert({
      bot_id: bot.id,
      advertiser_tg_user_id: String(user.id),
      task_type: pending.taskType,
      target: pending.target,
      reward_points: pending.reward,
      slots_total: slots,
      slots_remaining: slots,
      status: "pending",
    });
    if (insertError) {
      // Don't touch points or clear pending_action — nothing was charged
      // yet, so the user can just resend the same slot count to retry.
      await sendMenu(bot, template, chatId, `تعذّر إنشاء الحملة: ${insertError.message}. أعد إرسال العدد للمحاولة مجدداً.`);
      return;
    }
    await db.from("bot_members").update({ points: points - total }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
    await logPointsTx(bot.id, String(user.id), "campaign_spend", total, `${TASK_TYPE_LABEL[pending.taskType]} ${pending.target}`);
    await setPendingAction(bot, user, null);
    await sendMenu(
      bot,
      template,
      chatId,
      `تم إرسال حملتك للمراجعة (خُصم ${total} ${template.defaults.currencyName}). بعد موافقة المالك ستظهر في «المهام» لكل الأعضاء. تابعها من «حملاتي».`
    );
    return;
  }

  await sendMenu(bot, template, chatId, "اختر أحد الأزرار من القائمة.");
}

async function completeTask(bot: HostedBot, template: BotTemplate, task: any, user: TgUser, chatId: number, member: any) {
  const db = supabaseAdmin();
  const { error: dupError } = await db.from("ad_task_completions").insert({ task_id: task.id, tg_user_id: String(user.id) });
  if (dupError) {
    await sendMenu(bot, template, chatId, "استفدت من هذه المهمة مسبقاً.");
    return;
  }
  const newSlots = task.slots_remaining - 1;
  await db
    .from("ad_tasks")
    .update({ slots_remaining: newSlots, status: newSlots <= 0 ? "exhausted" : task.status })
    .eq("id", task.id);
  const newPoints = Number(member.points || 0) + Number(task.reward_points || 0);
  await db.from("bot_members").update({ points: newPoints }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
  await logPointsTx(bot.id, String(user.id), "task_reward", task.reward_points, `${TASK_TYPE_LABEL[task.task_type]} ${task.target}`);
  await sendMenu(bot, template, chatId, `أُضيفت ${task.reward_points} ${template.defaults.currencyName}! رصيدك الآن: ${newPoints}.`);
}
