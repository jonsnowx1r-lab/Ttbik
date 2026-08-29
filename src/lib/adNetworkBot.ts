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
 * clarified 2026-08-30, after sharing screenshots of a real reference bot,
 * exactly which categories and flow they meant by "بوت الإعلانات").
 *
 * Two top-level actions under "الإعلان":
 * - شاهد إعلان: browse and complete other members' campaigns to earn.
 * - ضع إعلانك: fund and launch your own campaign on one platform.
 *
 * Platforms: link, telegram, youtube, facebook, instagram, twitter
 * (twitter has a sub-type: retweet or follow, per the reference bot).
 *
 * Verification is real only where a free API allows it:
 * - telegram: real membership check via Telegram getChatMember.
 * - link / youtube / facebook / instagram / twitter: honesty-based
 *   self-confirmation. There is no free API to verify a YouTube
 *   subscribe, a Facebook/Instagram follow, or a Twitter/X retweet/follow
 *   for an arbitrary user without that user connecting their account via
 *   paid OAuth API access (X's API in particular requires a paid tier for
 *   this) — this is a real limitation, not a shortcut taken for
 *   convenience, and it's disclosed to the owner rather than faked.
 *
 * Campaign creation is a short multi-step conversation, driven by
 * bot_members.pending_action (jsonb) since this codebase has no
 * in-memory per-user state.
 */

type Platform = "link" | "telegram" | "youtube" | "facebook" | "instagram" | "twitter";
type TwitterSubType = "retweet" | "follow";
type CreateStep = "subtype" | "description" | "target" | "budget" | "cpc";

const MIN_CPC = 0.02;

const PLATFORM_LABEL: Record<Platform, string> = {
  link: "🔗 لينك",
  telegram: "📢 تلجرام",
  youtube: "▶️ يوتيوب",
  facebook: "📘 فيسبوك",
  instagram: "📸 انستغرام",
  twitter: "🐦 تويتر",
};

const PLATFORM_STEPS: Record<Platform, CreateStep[]> = {
  link: ["target", "budget", "cpc"],
  telegram: ["target", "budget", "cpc"],
  youtube: ["description", "target", "budget", "cpc"],
  facebook: ["description", "target", "budget", "cpc"],
  instagram: ["description", "target", "budget", "cpc"],
  twitter: ["subtype", "description", "target", "budget", "cpc"],
};

const STEP_PROMPT: Record<CreateStep, string> = {
  subtype: "اختر نوع مهمة تويتر:",
  description: "أرسل وصف حملتك (نص قصير يظهر للمستخدمين قبل تنفيذ المهمة):",
  target: "أرسل الرابط/الحساب الذي تريد الترويج له:",
  budget: "حدد ميزانية حملتك بالدولار (مثال: 100):",
  cpc: `حدد السعر لكل نقرة/مهمة بالدولار (الحد الأدنى $${MIN_CPC}, مثال: 0.02):`,
};

type Collected = { subType?: TwitterSubType; description?: string; target?: string; budget?: number; cpc?: number };
type PendingAction =
  | { mode: "create_campaign"; platform: Platform; stepIndex: number; collected: Collected }
  | { mode: "reviewing_campaign"; platform: Platform; collected: Collected };

const KNOWN_BUTTONS = ["الإعلان", "المحفظة", "الإحالات", "📊 الإحصائيات", "🌐 اللغة", "الأسئلة الشائعة", "سحب"];

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

// points is a decimal (numeric) column now that CPC can be fractional
// ($0.02) — plain float subtraction/addition drifts (e.g. 27.999999999999996
// instead of 28), so every balance mutation rounds to cents.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function setPendingAction(bot: HostedBot, user: TgUser, action: PendingAction | null) {
  await supabaseAdmin().from("bot_members").update({ pending_action: action }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
}

function platformKeyboard(prefix: string) {
  return {
    inline_keyboard: (Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => [{ text: PLATFORM_LABEL[p], callback_data: `${prefix}:${p}` }]),
  };
}

async function askNextStep(bot: HostedBot, chatId: number, platform: Platform, stepIndex: number, collected: Collected) {
  const steps = PLATFORM_STEPS[platform];
  const step = steps[stepIndex];
  if (step === "subtype") {
    await tgSend(bot.bot_token, chatId, STEP_PROMPT.subtype, {
      reply_markup: { inline_keyboard: [[{ text: "🔁 إعادة تغريد", callback_data: "subtype:retweet" }, { text: "➕ متابعة", callback_data: "subtype:follow" }]] },
    });
    return;
  }
  await tgSend(bot.bot_token, chatId, STEP_PROMPT[step]);
}

async function sendReview(bot: HostedBot, template: BotTemplate, chatId: number, platform: Platform, collected: Collected) {
  const clicks = Math.floor((collected.budget || 0) / (collected.cpc || MIN_CPC));
  const lines = [
    `مراجعة حملتك — ${PLATFORM_LABEL[platform]}`,
    collected.subType ? `النوع: ${collected.subType === "retweet" ? "إعادة تغريد" : "متابعة"}` : null,
    collected.description ? `الوصف: ${collected.description}` : null,
    `الهدف: ${collected.target}`,
    `الميزانية: ${fmt(collected.budget || 0)}`,
    `السعر لكل نقرة: ${fmt(collected.cpc || 0)}`,
    `عدد النقرات المتوقع: ~${clicks}`,
  ].filter(Boolean);
  await tgSend(bot.bot_token, chatId, lines.join("\n"), {
    reply_markup: { inline_keyboard: [[{ text: "تأكيد الإرسال ✅", callback_data: "campaign_confirm" }, { text: "إلغاء ❌", callback_data: "campaign_cancel" }]] },
  });
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
    const pending = member.pending_action as PendingAction | null;

    if (data === "watch_ads" || data === "place_ad") {
      await tgSend(bot.bot_token, chatId, "اختر المنصة:", { reply_markup: platformKeyboard(data === "watch_ads" ? "watch" : "place") });
      return;
    }

    if (data === "wallet_deposit" || data === "wallet_withdraw") {
      await handleWalletCallback(bot, template, member, user, chatId, data);
      return;
    }

    if (data.startsWith("watch:")) {
      const platform = data.slice(6) as Platform;
      const { data: tasks } = await db
        .from("ad_tasks")
        .select("id, platform, sub_type, description, target, cpc")
        .eq("bot_id", bot.id)
        .eq("platform", platform)
        .eq("status", "active")
        .gt("budget_remaining", 0)
        .neq("advertiser_tg_user_id", String(user.id))
        .order("created_at", { ascending: false })
        .limit(10);
      if (!tasks || tasks.length === 0) {
        await sendMenu(bot, template, chatId, "لا حملات متاحة على هذه المنصة حالياً.");
        return;
      }
      for (const t of tasks) {
        const subLabel = t.sub_type === "retweet" ? " (إعادة تغريد)" : t.sub_type === "follow" ? " (متابعة)" : "";
        const desc = t.description ? `\n${t.description}` : "";
        const isTelegram = t.platform === "telegram";
        await tgSend(bot.bot_token, chatId, `${PLATFORM_LABEL[platform]}${subLabel}${desc}\nالمكافأة: ${fmt(t.cpc)}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: isTelegram ? "افتح القناة" : "فتح الرابط", url: isTelegram ? `https://t.me/${t.target.replace(/^@/, "")}` : t.target }],
              [{ text: isTelegram ? "تحققت من الانضمام ✅" : "تأكيد الإتمام ✅", callback_data: `taskdone:${t.id}` }],
            ],
          },
        });
      }
      return;
    }

    if (data.startsWith("place:")) {
      const platform = data.slice(6) as Platform;
      const steps = PLATFORM_STEPS[platform];
      await setPendingAction(bot, user, { mode: "create_campaign", platform, stepIndex: 0, collected: {} });
      await askNextStep(bot, chatId, platform, 0, {});
      return;
    }

    if (data.startsWith("subtype:") && pending?.mode === "create_campaign" && PLATFORM_STEPS[pending.platform][pending.stepIndex] === "subtype") {
      const subType = data.slice(8) as TwitterSubType;
      const collected = { ...pending.collected, subType };
      const nextIndex = pending.stepIndex + 1;
      await setPendingAction(bot, user, { mode: "create_campaign", platform: pending.platform, stepIndex: nextIndex, collected });
      await askNextStep(bot, chatId, pending.platform, nextIndex, collected);
      return;
    }

    if (data.startsWith("taskdone:")) {
      const taskId = data.slice(9);
      const { data: task } = await db.from("ad_tasks").select("*").eq("id", taskId).eq("bot_id", bot.id).maybeSingle();
      if (!task || task.status !== "active" || Number(task.budget_remaining) < Number(task.cpc)) {
        await sendMenu(bot, template, chatId, "هذه المهمة لم تعد متاحة.");
        return;
      }
      if (task.advertiser_tg_user_id === String(user.id)) {
        await sendMenu(bot, template, chatId, "لا يمكنك إتمام حملتك الخاصة.");
        return;
      }
      if (task.platform === "telegram") {
        const isMember = await tgIsChannelMember(bot.bot_token, task.target, user.id);
        if (!isMember) {
          await sendMenu(bot, template, chatId, `لم يتم التحقق من انضمامك بعد إلى @${task.target}. انضم ثم أعد المحاولة.`);
          return;
        }
      }
      await completeTask(bot, template, task, user, chatId, member);
      return;
    }

    if (data === "campaign_confirm" && pending?.mode === "reviewing_campaign") {
      const { platform, collected } = pending;
      const budget = Number(collected.budget || 0);
      const points = Number(member.points || 0);
      if (budget > points) {
        await sendMenu(bot, template, chatId, `الميزانية ${fmt(budget)} أكبر من رصيدك (${fmt(points)}). أودع رصيداً أولاً:\n${depositLink(bot, user.id)}`);
        return;
      }
      const { error: insertError } = await db.from("ad_tasks").insert({
        bot_id: bot.id,
        advertiser_tg_user_id: String(user.id),
        platform,
        sub_type: collected.subType || null,
        description: collected.description || null,
        target: collected.target,
        budget_total: budget,
        budget_remaining: budget,
        cpc: collected.cpc,
        status: "pending",
      });
      if (insertError) {
        await sendMenu(bot, template, chatId, `تعذّر إنشاء الحملة: ${insertError.message}`);
        return;
      }
      await db.from("bot_members").update({ points: round2(points - budget) }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
      await logPointsTx(bot.id, String(user.id), "campaign_spend", budget, `${PLATFORM_LABEL[platform]} ${collected.target}`);
      await setPendingAction(bot, user, null);
      await sendMenu(bot, template, chatId, `تم إرسال حملتك للمراجعة (خُصم ${fmt(budget)}). بعد موافقة المالك ستظهر في «شاهد إعلان» لكل الأعضاء.`);
      return;
    }

    if (data === "campaign_cancel") {
      await setPendingAction(bot, user, null);
      await sendMenu(bot, template, chatId, "أُلغيت الحملة.");
      return;
    }

    return;
  }

  const msg = update.message;
  if (!msg?.from || !msg.chat) return;
  const user: TgUser = msg.from;
  const chatId = msg.chat.id;
  const member = await upsertMember(bot.id, user);
  const text = String(msg.text || "").trim();
  if (!text) return;

  if (text.startsWith("/start")) {
    const payload = text.slice(6).trim();
    if (payload) await maybeApplyReferral(bot, member, user, payload);
    await sendMenu(bot, template, chatId, bot.welcome_text || template.defaults.welcome);
    return;
  }

  const isKnownCommand = KNOWN_BUTTONS.includes(text) || text.startsWith("سحب:");
  const pending = member.pending_action as PendingAction | null;
  if (isKnownCommand && pending) {
    await setPendingAction(bot, user, null);
  }

  if (text === "المحفظة") {
    const points = Number(member.points || 0);
    await tgSend(bot.bot_token, chatId, `رصيدك: ${fmt(points)}`, {
      reply_markup: { inline_keyboard: [[{ text: "إيداع 💰", callback_data: "wallet_deposit" }, { text: "سحب 💸", callback_data: "wallet_withdraw" }]] },
    });
    return;
  }

  if (text === "الإعلان") {
    await tgSend(bot.bot_token, chatId, "ماذا تريد؟", {
      reply_markup: { inline_keyboard: [[{ text: "شاهد إعلان 👀", callback_data: "watch_ads" }], [{ text: "ضع إعلانك 📢", callback_data: "place_ad" }]] },
    });
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

  if (text === "🌐 اللغة") {
    const newLang = member.lang === "en" ? "ar" : "en";
    await db.from("bot_members").update({ lang: newLang }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
    await sendMenu(
      bot,
      template,
      chatId,
      newLang === "en"
        ? "Language set to English. Note: menu button labels stay Arabic for now — only key messages are translated."
        : "تم تعيين اللغة إلى العربية."
    );
    return;
  }

  if (text === "📊 الإحصائيات") {
    const [{ count: campaignsCreated }, { count: tasksCompleted }, spentRes, earnedRes] = await Promise.all([
      db.from("ad_tasks").select("id", { count: "exact", head: true }).eq("bot_id", bot.id).eq("advertiser_tg_user_id", String(user.id)),
      db.from("ad_task_completions").select("id", { count: "exact", head: true }).eq("tg_user_id", String(user.id)),
      db.from("bot_wallet_tx").select("amount").eq("bot_id", bot.id).eq("tg_user_id", String(user.id)).eq("kind", "campaign_spend"),
      db.from("bot_wallet_tx").select("amount").eq("bot_id", bot.id).eq("tg_user_id", String(user.id)).eq("kind", "task_reward"),
    ]);
    const totalSpent = (spentRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalEarned = (earnedRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    await sendMenu(
      bot,
      template,
      chatId,
      `📊 إحصائياتك:\nحملات أنشأتها: ${campaignsCreated || 0}\nإجمالي الصرف على الحملات: ${fmt(totalSpent)}\nمهام أتممتها: ${tasksCompleted || 0}\nإجمالي أرباحك من المهام: ${fmt(totalEarned)}`
    );
    return;
  }

  if (text === "سحب" || text.startsWith("سحب:")) {
    await tryHandleWithdrawal(bot, template, member, user, chatId, text);
    return;
  }

  // Multi-step campaign creation — consumes bot_members.pending_action.
  if (pending?.mode === "create_campaign") {
    const { platform, stepIndex, collected } = pending;
    const step = PLATFORM_STEPS[platform][stepIndex];
    let updated = { ...collected };
    if (step === "description") {
      if (!text) {
        await sendMenu(bot, template, chatId, "أرسل وصفاً غير فارغ.");
        return;
      }
      updated.description = text;
    } else if (step === "target") {
      updated.target = text;
    } else if (step === "budget") {
      const budget = Number(text.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(budget) || budget <= 0) {
        await sendMenu(bot, template, chatId, "أرسل رقماً صحيحاً أكبر من صفر بالدولار.");
        return;
      }
      updated.budget = budget;
    } else if (step === "cpc") {
      const cpc = Number(text.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(cpc) || cpc < MIN_CPC) {
        await sendMenu(bot, template, chatId, `السعر لكل نقرة لا يقل عن $${MIN_CPC}.`);
        return;
      }
      if (updated.budget && cpc > updated.budget) {
        await sendMenu(bot, template, chatId, "السعر لكل نقرة أكبر من الميزانية الكلية.");
        return;
      }
      updated.cpc = cpc;
    }

    const nextIndex = stepIndex + 1;
    if (nextIndex >= PLATFORM_STEPS[platform].length) {
      await setPendingAction(bot, user, { mode: "reviewing_campaign", platform, collected: updated });
      await sendReview(bot, template, chatId, platform, updated);
      return;
    }
    await setPendingAction(bot, user, { mode: "create_campaign", platform, stepIndex: nextIndex, collected: updated });
    await askNextStep(bot, chatId, platform, nextIndex, updated);
    return;
  }

  await sendMenu(bot, template, chatId, "اختر أحد الأزرار من القائمة.");
}

// "wallet_deposit"/"wallet_withdraw" callbacks are handled as plain text
// commands for simplicity — Telegram inline buttons can't type text for the
// user, so we translate the tap into the same flow "سحب" already uses, and
// point deposit at the same manual-review link used everywhere else on the
// site (a real automated on-chain deposit address is a separate, much
// bigger decision — see the chat reply, not implemented here yet).
async function handleWalletCallback(bot: HostedBot, template: BotTemplate, member: any, user: TgUser, chatId: number, action: string) {
  if (action === "wallet_deposit") {
    await sendMenu(bot, template, chatId, `اشترِ رصيداً (بعد مراجعة يدوية من المالك):\n${depositLink(bot, user.id)}`);
    return;
  }
  await tryHandleWithdrawal(bot, template, member, user, chatId, "سحب");
}

async function completeTask(bot: HostedBot, template: BotTemplate, task: any, user: TgUser, chatId: number, member: any) {
  const db = supabaseAdmin();
  const cpc = Number(task.cpc);
  const { error: dupError } = await db.from("ad_task_completions").insert({ task_id: task.id, tg_user_id: String(user.id), amount: cpc });
  if (dupError) {
    await sendMenu(bot, template, chatId, "استفدت من هذه المهمة مسبقاً.");
    return;
  }
  const newRemaining = round2(Number(task.budget_remaining) - cpc);
  await db
    .from("ad_tasks")
    .update({ budget_remaining: newRemaining, status: newRemaining < cpc ? "exhausted" : task.status })
    .eq("id", task.id);
  const newPoints = round2(Number(member.points || 0) + cpc);
  await db.from("bot_members").update({ points: newPoints }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
  await logPointsTx(bot.id, String(user.id), "task_reward", cpc, `${PLATFORM_LABEL[task.platform as Platform]} ${task.target}`);
  await sendMenu(bot, template, chatId, `أُضيف ${fmt(cpc)}! رصيدك الآن: ${fmt(newPoints)}.`);
}
