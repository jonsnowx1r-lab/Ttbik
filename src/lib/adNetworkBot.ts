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
 * Navigation is built entirely from Telegram *reply keyboards* (the
 * persistent button grid pinned above the text field), matching the
 * reference bot's UX — the owner flagged (2026-08-30, with a screenshot)
 * that inline buttons floating in the chat feed, on top of a message, do
 * not read as a real "menu" the way a reference ad bot's does. The only
 * place inline keyboards remain is a per-task "open link / mark done" card
 * under "شاهد إعلان", because Telegram's reply keyboards cannot open an
 * external URL — only an inline button's `url` field can — so that one
 * case is a platform constraint, not a style choice.
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

type Platform = "link" | "telegram" | "youtube" | "facebook" | "instagram" | "twitter" | "tiktok";
type TwitterSubType = "retweet" | "follow";
type CreateStep = "subtype" | "description" | "target" | "budget" | "cpc";

const MIN_CPC = 0.02;
const BACK = "🔙 رجوع";

// Revenue split on every completed task (owner decision 2026-08-31): the
// worker no longer keeps the full cpc — a cut goes to the bot creator (as
// an incentive to bring users) and a cut to the platform. The worker share
// absorbs any rounding remainder so the three cuts always sum exactly to cpc.
const WORKER_SHARE = 0.5;
const CREATOR_SHARE = 0.2;
const PLATFORM_SHARE = 0.3;

const PLATFORM_LABEL: Record<Platform, string> = {
  link: "🔗 لينك",
  telegram: "📢 تلجرام",
  youtube: "▶️ يوتيوب",
  facebook: "📘 فيسبوك",
  instagram: "📸 انستغرام",
  twitter: "🐦 تويتر",
  tiktok: "🎵 تيك توك",
};
const LABEL_TO_PLATFORM: Record<string, Platform> = Object.fromEntries(
  (Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => [PLATFORM_LABEL[p], p])
) as Record<string, Platform>;

const PLATFORM_STEPS: Record<Platform, CreateStep[]> = {
  link: ["target", "budget", "cpc"],
  telegram: ["target", "budget", "cpc"],
  youtube: ["description", "target", "budget", "cpc"],
  facebook: ["description", "target", "budget", "cpc"],
  instagram: ["description", "target", "budget", "cpc"],
  tiktok: ["description", "target", "budget", "cpc"],
  twitter: ["subtype", "description", "target", "budget", "cpc"],
};

const STEP_PROMPT: Record<CreateStep, string> = {
  subtype: "اختر نوع مهمة تويتر:",
  description: "أرسل وصف حملتك (نص قصير يظهر للمستخدمين قبل تنفيذ المهمة):",
  target: "أرسل الرابط/الحساب الذي تريد الترويج له:",
  budget: "حدد ميزانية حملتك بالدولار (مثال: 100):",
  cpc: `حدد السعر لكل نقرة/مهمة بالدولار (الحد الأدنى $${MIN_CPC}, مثال: 0.02):`,
};

// Persistent reply keyboards (the pinned button grid), one per menu "screen".
// resize_keyboard keeps them compact instead of full-width huge buttons.
const AD_MENU_KB = { keyboard: [["شاهد إعلان 👀", "ضع إعلانك 📢"], [BACK]], resize_keyboard: true };
const PLATFORM_MENU_KB = {
  keyboard: [
    [PLATFORM_LABEL.link, PLATFORM_LABEL.telegram],
    [PLATFORM_LABEL.youtube, PLATFORM_LABEL.facebook],
    [PLATFORM_LABEL.instagram, PLATFORM_LABEL.twitter],
    [PLATFORM_LABEL.tiktok],
    [BACK],
  ],
  resize_keyboard: true,
};
const TWITTER_SUBTYPE_KB = { keyboard: [["🔁 إعادة تغريد", "➕ متابعة"], [BACK]], resize_keyboard: true };
const REVIEW_KB = { keyboard: [["تأكيد الإرسال ✅", "إلغاء ❌"]], resize_keyboard: true };
const WALLET_KB = { keyboard: [["إيداع 💰", "سحب 💸"], [BACK]], resize_keyboard: true };

type Collected = { subType?: TwitterSubType; description?: string; target?: string; budget?: number; cpc?: number };
type PendingAction =
  | { mode: "platform_pick"; intent: "watch" | "place" }
  | { mode: "create_campaign"; platform: Platform; stepIndex: number; collected: Collected }
  | { mode: "reviewing_campaign"; platform: Platform; collected: Collected };

const TOP_BUTTONS = ["الإعلان", "المحفظة", "الإحالات", "📊 الإحصائيات", "🌐 اللغة", "الأسئلة الشائعة", "سحب", "💼 أرباحي"];
const MIN_CREATOR_WITHDRAWAL = 1;

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

async function askNextStep(bot: HostedBot, chatId: number, platform: Platform, stepIndex: number, collected: Collected) {
  const steps = PLATFORM_STEPS[platform];
  const step = steps[stepIndex];
  if (step === "subtype") {
    await tgSend(bot.bot_token, chatId, STEP_PROMPT.subtype, { reply_markup: TWITTER_SUBTYPE_KB });
    return;
  }
  await tgSend(bot.bot_token, chatId, STEP_PROMPT[step], { reply_markup: { remove_keyboard: true } });
}

async function sendReview(bot: HostedBot, chatId: number, platform: Platform, collected: Collected) {
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
  await tgSend(bot.bot_token, chatId, lines.join("\n"), { reply_markup: REVIEW_KB });
}

export async function handleAdNetworkUpdate(bot: HostedBot, template: BotTemplate, update: any) {
  const db = supabaseAdmin();

  if (update.callback_query) {
    // Only the per-task "mark done" card (paired with a url button) still
    // uses inline keyboards — everything else is reply-keyboard driven.
    const cq = update.callback_query;
    const user: TgUser = cq.from;
    const chatId = cq.message?.chat?.id ?? user.id;
    await tgAnswerCallback(bot.bot_token, cq.id);
    const member = await upsertMember(bot.id, user);
    const data = String(cq.data || "");

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
    await setPendingAction(bot, user, null);
    await sendMenu(bot, template, chatId, bot.welcome_text || template.defaults.welcome);
    return;
  }

  const pending = member.pending_action as PendingAction | null;

  // Universal back button: always returns to the main persistent menu.
  if (text === BACK) {
    await setPendingAction(bot, user, null);
    await sendMenu(bot, template, chatId, "القائمة الرئيسية:");
    return;
  }

  if (TOP_BUTTONS.includes(text) && pending) {
    await setPendingAction(bot, user, null);
  }

  if (text === "المحفظة") {
    const points = Number(member.points || 0);
    await tgSend(bot.bot_token, chatId, `رصيدك: ${fmt(points)}`, { reply_markup: WALLET_KB });
    return;
  }

  if (text === "إيداع 💰") {
    const note = process.env.NOWPAYMENTS_API_KEY
      ? "اختر «الدفع بعملة رقمية» في الصفحة لإضافة الرصيد تلقائياً فور التأكيد، أو التحويل اليدوي إن فضّلت."
      : "التحويل يُراجع يدوياً قبل إضافة الرصيد.";
    await tgSend(bot.bot_token, chatId, `أودع رصيداً:\n${depositLink(bot, user.id)}\n${note}`, { reply_markup: WALLET_KB });
    return;
  }

  if (text === "سحب 💸") {
    await tryHandleWithdrawal(bot, template, member, user, chatId, "سحب");
    return;
  }

  if (text === "الإعلان") {
    await tgSend(bot.bot_token, chatId, "ماذا تريد؟", { reply_markup: AD_MENU_KB });
    return;
  }

  if (text === "شاهد إعلان 👀" || text === "ضع إعلانك 📢") {
    const intent: "watch" | "place" = text === "شاهد إعلان 👀" ? "watch" : "place";
    await setPendingAction(bot, user, { mode: "platform_pick", intent });
    await tgSend(bot.bot_token, chatId, "اختر المنصة:", { reply_markup: PLATFORM_MENU_KB });
    return;
  }

  if (pending?.mode === "platform_pick" && LABEL_TO_PLATFORM[text]) {
    const platform = LABEL_TO_PLATFORM[text];
    if (pending.intent === "watch") {
      await setPendingAction(bot, user, null);
      await sendWatchList(bot, template, platform, user, chatId);
      return;
    }
    const steps = PLATFORM_STEPS[platform];
    await setPendingAction(bot, user, { mode: "create_campaign", platform, stepIndex: 0, collected: {} });
    await askNextStep(bot, chatId, platform, 0, {});
    return;
  }

  if (
    pending?.mode === "create_campaign" &&
    PLATFORM_STEPS[pending.platform][pending.stepIndex] === "subtype" &&
    (text === "🔁 إعادة تغريد" || text === "➕ متابعة")
  ) {
    const subType: TwitterSubType = text === "🔁 إعادة تغريد" ? "retweet" : "follow";
    const collected = { ...pending.collected, subType };
    const nextIndex = pending.stepIndex + 1;
    await setPendingAction(bot, user, { mode: "create_campaign", platform: pending.platform, stepIndex: nextIndex, collected });
    await askNextStep(bot, chatId, pending.platform, nextIndex, collected);
    return;
  }

  if (pending?.mode === "reviewing_campaign" && (text === "تأكيد الإرسال ✅" || text === "إلغاء ❌")) {
    if (text === "إلغاء ❌") {
      await setPendingAction(bot, user, null);
      await sendMenu(bot, template, chatId, "أُلغيت الحملة.");
      return;
    }
    const { platform, collected } = pending;
    const budget = Number(collected.budget || 0);
    const points = Number(member.points || 0);
    if (budget > points) {
      await tgSend(bot.bot_token, chatId, `الميزانية ${fmt(budget)} أكبر من رصيدك (${fmt(points)}). أودع رصيداً أولاً:\n${depositLink(bot, user.id)}`, { reply_markup: REVIEW_KB });
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
      await tgSend(bot.bot_token, chatId, `تعذّر إنشاء الحملة: ${insertError.message}`, { reply_markup: REVIEW_KB });
      return;
    }
    await db.from("bot_members").update({ points: round2(points - budget) }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
    await logPointsTx(bot.id, String(user.id), "campaign_spend", budget, `${PLATFORM_LABEL[platform]} ${collected.target}`);
    await setPendingAction(bot, user, null);
    await sendMenu(bot, template, chatId, `تم إرسال حملتك للمراجعة (خُصم ${fmt(budget)}). بعد موافقة المالك ستظهر في «شاهد إعلان» لكل الأعضاء.`);
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

  if (text === "💼 أرباحي") {
    await handleCreatorEarnings(bot, template, user, chatId);
    return;
  }

  if (text.startsWith("سحب أرباحي:")) {
    await handleCreatorWithdrawRequest(bot, template, user, chatId, text);
    return;
  }

  // Multi-step campaign creation — consumes bot_members.pending_action.
  if (pending?.mode === "create_campaign") {
    const { platform, stepIndex, collected } = pending;
    const step = PLATFORM_STEPS[platform][stepIndex];
    let updated = { ...collected };
    if (step === "description") {
      if (!text) {
        await tgSend(bot.bot_token, chatId, "أرسل وصفاً غير فارغ.");
        return;
      }
      updated.description = text;
    } else if (step === "target") {
      updated.target = text;
    } else if (step === "budget") {
      const budget = Number(text.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(budget) || budget <= 0) {
        await tgSend(bot.bot_token, chatId, "أرسل رقماً صحيحاً أكبر من صفر بالدولار.");
        return;
      }
      updated.budget = budget;
    } else if (step === "cpc") {
      const cpc = Number(text.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(cpc) || cpc < MIN_CPC) {
        await tgSend(bot.bot_token, chatId, `السعر لكل نقرة لا يقل عن $${MIN_CPC}.`);
        return;
      }
      if (updated.budget && cpc > updated.budget) {
        await tgSend(bot.bot_token, chatId, "السعر لكل نقرة أكبر من الميزانية الكلية.");
        return;
      }
      updated.cpc = cpc;
    }

    const nextIndex = stepIndex + 1;
    if (nextIndex >= PLATFORM_STEPS[platform].length) {
      await setPendingAction(bot, user, { mode: "reviewing_campaign", platform, collected: updated });
      await sendReview(bot, chatId, platform, updated);
      return;
    }
    await setPendingAction(bot, user, { mode: "create_campaign", platform, stepIndex: nextIndex, collected: updated });
    await askNextStep(bot, chatId, platform, nextIndex, updated);
    return;
  }

  await sendMenu(bot, template, chatId, "اختر أحد الأزرار من القائمة.");
}

async function sendWatchList(bot: HostedBot, template: BotTemplate, platform: Platform, user: TgUser, chatId: number) {
  const db = supabaseAdmin();
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
  // Per-task cards keep inline buttons on purpose: a reply keyboard button
  // can only send text back, it cannot open an external URL — only an
  // inline button's `url` field can, so this one case stays inline.
  // Forced global platform ad (owner decision 2026-08-31): roughly 1-in-5
  // views on this platform shows one unpaid promo for the platform owner's
  // own channel/service, clearly labeled as such — never disguised as a
  // normal paid task, and never carrying a reward button since no advertiser
  // budget backs it.
  const { data: platformAds } = await db
    .from("platform_ads")
    .select("id, platform, description, target")
    .eq("platform", platform)
    .eq("is_active", true);
  const platformAd = platformAds && platformAds.length > 0 && Math.random() < 0.2 ? platformAds[Math.floor(Math.random() * platformAds.length)] : null;
  if (platformAd) {
    const desc = platformAd.description ? `\n${platformAd.description}` : "";
    await tgSend(bot.bot_token, chatId, `🌟 عرض من المنصة${desc}`, {
      reply_markup: { inline_keyboard: [[{ text: "فتح الرابط", url: platformAd.target }]] },
    });
  }

  // Per-task cards keep inline buttons on purpose: a reply keyboard button
  // can only send text back, it cannot open an external URL — only an
  // inline button's `url` field can, so this one case stays inline.
  for (const t of tasks) {
    const subLabel = t.sub_type === "retweet" ? " (إعادة تغريد)" : t.sub_type === "follow" ? " (متابعة)" : "";
    const desc = t.description ? `\n${t.description}` : "";
    const isTelegram = t.platform === "telegram";
    const { workerCut } = splitCpc(Number(t.cpc));
    await tgSend(bot.bot_token, chatId, `${PLATFORM_LABEL[platform]}${subLabel}${desc}\nالمكافأة: ${fmt(workerCut)}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: isTelegram ? "افتح القناة" : "فتح الرابط", url: isTelegram ? `https://t.me/${t.target.replace(/^@/, "")}` : t.target }],
          [{ text: isTelegram ? "تحققت من الانضمام ✅" : "تأكيد الإتمام ✅", callback_data: `taskdone:${t.id}` }],
        ],
      },
    });
  }
  await sendMenu(bot, template, chatId, "بعد إتمام مهمة اضغط زر التأكيد أسفل بطاقتها. للرجوع للقائمة الرئيسية:");
}

// Splits cpc into worker/creator/platform cuts. The worker share absorbs
// the rounding remainder so the three numbers always sum exactly to cpc
// (e.g. cpc=$0.02 -> worker $0.01, creator $0.004->rounds separately, so we
// compute creator/platform first, then worker = cpc - creator - platform).
function splitCpc(cpc: number) {
  const creatorCut = round2(cpc * CREATOR_SHARE);
  const platformCut = round2(cpc * PLATFORM_SHARE);
  const workerCut = round2(cpc - creatorCut - platformCut);
  return { workerCut, creatorCut, platformCut };
}

async function completeTask(bot: HostedBot, template: BotTemplate, task: any, user: TgUser, chatId: number, member: any) {
  const db = supabaseAdmin();
  const cpc = Number(task.cpc);
  const { workerCut, creatorCut, platformCut } = splitCpc(cpc);
  const { error: dupError } = await db
    .from("ad_task_completions")
    .insert({ task_id: task.id, tg_user_id: String(user.id), amount: workerCut, creator_cut: creatorCut, platform_cut: platformCut });
  if (dupError) {
    await sendMenu(bot, template, chatId, "استفدت من هذه المهمة مسبقاً.");
    return;
  }
  const newRemaining = round2(Number(task.budget_remaining) - cpc);
  await db
    .from("ad_tasks")
    .update({ budget_remaining: newRemaining, status: newRemaining < cpc ? "exhausted" : task.status })
    .eq("id", task.id);
  const newPoints = round2(Number(member.points || 0) + workerCut);
  await db.from("bot_members").update({ points: newPoints }).eq("bot_id", bot.id).eq("tg_user_id", String(user.id));
  await logPointsTx(bot.id, String(user.id), "task_reward", workerCut, `${PLATFORM_LABEL[task.platform as Platform]} ${task.target}`);

  const { data: botRow } = await db.from("hosted_bots").select("owner_balance").eq("id", bot.id).maybeSingle();
  await db.from("hosted_bots").update({ owner_balance: round2(Number(botRow?.owner_balance || 0) + creatorCut) }).eq("id", bot.id);

  const { data: ledger } = await db.from("platform_ledger").select("total_revenue").eq("id", true).maybeSingle();
  await db.from("platform_ledger").update({ total_revenue: round2(Number(ledger?.total_revenue || 0) + platformCut) }).eq("id", true);

  await sendMenu(bot, template, chatId, `أُضيف ${fmt(workerCut)}! رصيدك الآن: ${fmt(newPoints)}.`);
}

// Bot creator (tenant owner) earnings — 20% of every completed task's cpc
// on their bot (owner decision 2026-08-31). Gated the same way the store
// template gates "متجري": config.creator_tg_id must be set by the creator
// via BotBuilder/admin and match the Telegram user asking, otherwise the
// section refuses (unset = no one can withdraw platform funds by accident).
async function handleCreatorEarnings(bot: HostedBot, template: BotTemplate, user: TgUser, chatId: number) {
  const creatorId = bot.config?.creator_tg_id ? String(bot.config.creator_tg_id) : null;
  if (!creatorId) {
    await sendMenu(bot, template, chatId, "لم يُحدَّد منشئ لهذا البوت بعد. عيّن «آيدي تليجرام لمنشئ البوت» من صفحة إنشاء البوت أو لوحة الإدارة أولاً.");
    return;
  }
  if (creatorId !== String(user.id)) {
    await sendMenu(bot, template, chatId, "هذا القسم مخصَّص لمنشئ البوت فقط.");
    return;
  }
  const db = supabaseAdmin();
  const { data: botRow } = await db.from("hosted_bots").select("owner_balance").eq("id", bot.id).maybeSingle();
  const balance = Number(botRow?.owner_balance || 0);
  await sendMenu(
    bot,
    template,
    chatId,
    `💼 أرباحك كمنشئ هذا البوت: ${fmt(balance)}\n(20% من كل نقرة مكتملة على حملات هذا البوت)\n\nللسحب أرسل: سحب أرباحي: المبلغ (الحد الأدنى $${MIN_CREATOR_WITHDRAWAL})`
  );
}

async function handleCreatorWithdrawRequest(bot: HostedBot, template: BotTemplate, user: TgUser, chatId: number, text: string) {
  const creatorId = bot.config?.creator_tg_id ? String(bot.config.creator_tg_id) : null;
  if (!creatorId || creatorId !== String(user.id)) {
    await sendMenu(bot, template, chatId, "هذا القسم مخصَّص لمنشئ البوت فقط.");
    return;
  }
  const amount = Number(text.split(":")[1]?.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount < MIN_CREATOR_WITHDRAWAL) {
    await sendMenu(bot, template, chatId, `الحد الأدنى للسحب $${MIN_CREATOR_WITHDRAWAL}. الصيغة: سحب أرباحي: المبلغ`);
    return;
  }
  const db = supabaseAdmin();
  const { data: botRow } = await db.from("hosted_bots").select("owner_balance").eq("id", bot.id).maybeSingle();
  const balance = Number(botRow?.owner_balance || 0);
  if (amount > balance) {
    await sendMenu(bot, template, chatId, `رصيدك ${fmt(balance)} فقط، لا يمكن سحب ${fmt(amount)}.`);
    return;
  }
  await db.from("hosted_bots").update({ owner_balance: round2(balance - amount) }).eq("id", bot.id);
  await db.from("bot_owner_withdrawals").insert({ bot_id: bot.id, amount: round2(amount), status: "pending" });
  await sendMenu(bot, template, chatId, `تم إرسال طلب سحب ${fmt(amount)}. سيُراجَع يدوياً من مالك المنصة.`);
}
