import { Bot as TelegramBot, Keyboard } from "grammy";
import { prisma } from "@/lib/prisma";
import type { Bot as BotRow } from "@prisma/client";

/**
 * AD_BOT template — grammy + Prisma, per the owner's blueprint. Navigation
 * is built entirely from Telegram *reply keyboards* (Keyboard, the pinned
 * bottom button grid) per explicit owner instruction (2026-08-31, with a
 * literal grammy code sample): no InlineKeyboard anywhere, no buttons
 * attached to individual chat messages. Two consequences of that constraint,
 * solved without inline buttons:
 *
 * - A reply-keyboard button can only send text back — it cannot open an
 *   external URL (only an inline button's `url` field can, which is banned
 *   here). So "شاهد واربح" sends each ad's link as plain text (Telegram
 *   auto-linkifies it) and offers a short "✅ <id>" confirm button per ad
 *   instead of a per-message button pair.
 * - Withdrawal approval would normally be an inline button in the admin's
 *   chat; here the admin is asked to type "موافقة <id>" / "رفض <id>"
 *   instead — plain text, matching the same no-inline-anywhere rule.
 *
 * Two things beyond the literal blueprint, both hard technical/financial
 * necessities rather than design choices:
 * 1. `User.pendingAction` (Prisma) tracks a mid-flight multi-step
 *    conversation. Vercel serverless functions don't keep in-memory state
 *    between requests, so grammy's default session middleware can't
 *    reliably drive "ضع إعلانك" without it.
 * 2. Double-claim protection on a completed ad via a synthetic unique
 *    `Transaction.txHash` (`task_<adId>_<userId>`) — without it, repeatedly
 *    tapping confirm would drain an ad's budget infinitely.
 *
 * Revenue split (per completed task, computed once at ad creation and
 * reused every time someone completes it): 50% worker / 20% bot creator /
 * 30% platform.
 */

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || "";
const MIN_CPC = 0.02;
const MIN_WITHDRAWAL = 1;
const BACK = "🔙 القائمة الرئيسية";

type AdTypeStr = "LINK" | "TELEGRAM" | "YOUTUBE" | "TWITTER" | "TIKTOK" | "FACEBOOK" | "INSTAGRAM";
const AD_TYPES: AdTypeStr[] = ["LINK", "TELEGRAM", "YOUTUBE", "TWITTER", "TIKTOK", "FACEBOOK", "INSTAGRAM"];
const TYPE_LABEL: Record<AdTypeStr, string> = {
  LINK: "🌐 رابط",
  TELEGRAM: "✈️ تلجرام",
  YOUTUBE: "▶️ يوتيوب",
  TWITTER: "🐦 تويتر/X",
  TIKTOK: "🎵 تيك توك",
  FACEBOOK: "📘 فيسبوك",
  INSTAGRAM: "📸 انستغرام",
};
const LABEL_TO_TYPE: Record<string, AdTypeStr> = Object.fromEntries(AD_TYPES.map((t) => [TYPE_LABEL[t], t])) as Record<string, AdTypeStr>;
const NEEDS_DESCRIPTION: AdTypeStr[] = ["YOUTUBE", "TIKTOK", "FACEBOOK", "INSTAGRAM"];

type CreateAdCollected = { subType?: "retweet" | "follow"; description?: string; target?: string; budget?: number; cpc?: number };
type PendingAction =
  | { mode: "platform_pick"; intent: "watch" | "create" }
  | { mode: "create_ad"; type: AdTypeStr; step: "subtype" | "description" | "target" | "budget" | "cpc"; collected: CreateAdCollected }
  | { mode: "reviewing_ad"; type: AdTypeStr; collected: CreateAdCollected }
  | { mode: "withdraw" }
  | { mode: "admin_broadcast" }
  | { mode: "admin_global_ad_platform" }
  | { mode: "admin_global_ad_target"; type: AdTypeStr };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}
function splitCpc(cpc: number) {
  const ownerCut = round2(cpc * 0.3);
  const creatorCut = round2(cpc * 0.2);
  const workerCut = round2(cpc - ownerCut - creatorCut);
  return { ownerCut, creatorCut, workerCut };
}
function shortId(id: string): string {
  return id.slice(-6);
}

// --- Reply keyboards (pinned bottom button grid) ---
const MAIN_MENU = new Keyboard()
  .text("➕ ضع إعلانك").text("👀 شاهد واربح").row()
  .text("💰 المحفظة").text("🙌 الإحالات").row()
  .text("📊 إحصائيات").text("💼 أرباحي").row()
  .text("🌐 اللغة").text("❓ الأسئلة الشائعة").row()
  .resized();

const WALLET_MENU = new Keyboard().text("📥 إيداع").text("📤 سحب").row().text(BACK).resized();

function typeMenu(): Keyboard {
  const kb = new Keyboard();
  AD_TYPES.forEach((t, i) => {
    kb.text(TYPE_LABEL[t]);
    if (i % 2 === 1) kb.row();
  });
  if (AD_TYPES.length % 2 === 1) kb.row();
  kb.text(BACK);
  return kb.resized();
}
const TYPE_MENU = typeMenu();

const TWITTER_SUBTYPE_MENU = new Keyboard().text("🔁 إعادة تغريد").text("➕ متابعة").row().text(BACK).resized();
const REVIEW_MENU = new Keyboard().text("✅ تأكيد الإرسال").text("❌ إلغاء").resized();
const AMOUNT_ENTRY_MENU = new Keyboard().text(BACK).resized();

const TOP_LEVEL_TEXTS = ["➕ ضع إعلانك", "👀 شاهد واربح", "💰 المحفظة", "🙌 الإحالات", "📊 إحصائيات", "💼 أرباحي", "🌐 اللغة", "❓ الأسئلة الشائعة"];

async function setPending(userId: string, action: PendingAction | null) {
  await prisma.user.update({ where: { id: userId }, data: { pendingAction: action as any } });
}

async function ensureUser(botId: string, tgUserId: string, botRow: BotRow, referredBy?: string | null) {
  const existing = await prisma.user.findUnique({ where: { id: tgUserId } });
  if (existing) return existing;
  const role = tgUserId === SUPER_ADMIN_ID ? "SUPER_ADMIN" : tgUserId === botRow.ownerId ? "BOT_OWNER" : "USER";
  return prisma.user.create({ data: { id: tgUserId, botId, role, referredBy: referredBy || null } });
}

export async function handleAdBotUpdate(bot: TelegramBot, botRow: BotRow, update: any) {
  const msg = update.message;
  if (!msg?.from || !msg.chat) return;
  const chatId = msg.chat.id;
  const tgUserId = String(msg.from.id);
  const text = String(msg.text || "").trim();
  if (!text) return;

  if (text.startsWith("/start")) {
    const payload = text.slice(6).trim();
    const user = await ensureUser(botRow.id, tgUserId, botRow, payload && payload !== tgUserId ? payload : null);
    await setPending(user.id, null);
    await bot.api.sendMessage(chatId, "🚀 مرحباً بك في منصة الإعلانات! اختر من القائمة أدناه:", { reply_markup: MAIN_MENU });
    return;
  }

  if (text === "/admin") {
    if (tgUserId !== SUPER_ADMIN_ID) {
      await bot.api.sendMessage(chatId, "⛔ عذراً، هذا الأمر مخصص لمالك المنصة فقط.");
      return;
    }
    const kb = new Keyboard()
      .text("📢 إعلان إجباري شامل").row()
      .text("📣 إذاعة لكل المستخدمين").row()
      .text("📊 الإحصائيات والأرباح").row()
      .text(BACK)
      .resized();
    await bot.api.sendMessage(chatId, "🛠 لوحة تحكم المالك الأكبر", { reply_markup: kb });
    return;
  }

  const user = await ensureUser(botRow.id, tgUserId, botRow);
  const pending = user.pendingAction as PendingAction | null;

  // Universal back button.
  if (text === BACK) {
    await setPending(user.id, null);
    await bot.api.sendMessage(chatId, "🏠 القائمة الرئيسية:", { reply_markup: MAIN_MENU });
    return;
  }

  if (TOP_LEVEL_TEXTS.includes(text) && pending) {
    await setPending(user.id, null);
  }

  if (text === "➕ ضع إعلانك") {
    await setPending(user.id, { mode: "platform_pick", intent: "create" });
    await bot.api.sendMessage(chatId, "📢 إضافة إعلان جديد\nاختر المنصة:", { reply_markup: TYPE_MENU });
    return;
  }
  if (text === "👀 شاهد واربح") {
    await setPending(user.id, { mode: "platform_pick", intent: "watch" });
    await bot.api.sendMessage(chatId, "اختر المنصة:", { reply_markup: TYPE_MENU });
    return;
  }
  if (text === "💰 المحفظة") {
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    await bot.api.sendMessage(chatId, `💳 قسم المحفظة\n\nرصيدك الحالي: ${fmt(Number(fresh?.balance || 0))}\nاختر العملية المطلوبة:`, { reply_markup: WALLET_MENU });
    return;
  }
  if (text === "🙌 الإحالات") {
    const me = await bot.api.getMe();
    await bot.api.sendMessage(chatId, `🔗 رابط الإحالة الخاص بك:\nhttps://t.me/${me.username}?start=${user.id}`, { reply_markup: MAIN_MENU });
    return;
  }
  if (text === "📊 إحصائيات") {
    await sendStats(bot, chatId, user.id);
    return;
  }
  if (text === "💼 أرباحي") {
    await sendCreatorEarnings(bot, chatId, botRow, user);
    return;
  }
  if (text === "🌐 اللغة") {
    await bot.api.sendMessage(chatId, "الواجهة حالياً بالعربية فقط. دعم لغات إضافية قيد التطوير.", { reply_markup: MAIN_MENU });
    return;
  }
  if (text === "❓ الأسئلة الشائعة") {
    await bot.api.sendMessage(
      chatId,
      "❓ الأسئلة الشائعة:\n\n• كيف أربح؟ اضغط «شاهد واربح»، اختر منصة، وأتمّ المهام المتاحة.\n• كيف أعلن؟ اضغط «ضع إعلانك»، حدد ميزانيتك وسعر النقرة.\n• كيف أودع/أسحب؟ من «المحفظة».\n• هل التحقق حقيقي؟ نعم لقنوات تلجرام فقط (لا يوجد API مجاني للتحقق من متابعة/تغريد على منصات أخرى).",
      { reply_markup: MAIN_MENU }
    );
    return;
  }
  if (text === "📥 إيداع") {
    await sendDepositOptions(bot, chatId, user.id);
    return;
  }
  if (text === "📤 سحب") {
    await setPending(user.id, { mode: "withdraw" });
    await bot.api.sendMessage(chatId, `أرسل المبلغ المراد سحبه بالدولار (الحد الأدنى $${MIN_WITHDRAWAL}):`, { reply_markup: AMOUNT_ENTRY_MENU });
    return;
  }

  // --- Super Admin menu ---
  if (text === "📢 إعلان إجباري شامل" && tgUserId === SUPER_ADMIN_ID) {
    await setPending(user.id, { mode: "admin_global_ad_platform" });
    await bot.api.sendMessage(chatId, "اختر منصة الإعلان الإجباري:", { reply_markup: TYPE_MENU });
    return;
  }
  if (text === "📣 إذاعة لكل المستخدمين" && tgUserId === SUPER_ADMIN_ID) {
    await setPending(user.id, { mode: "admin_broadcast" });
    await bot.api.sendMessage(chatId, "أرسل نص الرسالة التي ستصل لكل مستخدمي المنصة:", { reply_markup: AMOUNT_ENTRY_MENU });
    return;
  }
  if (text === "📊 الإحصائيات والأرباح" && tgUserId === SUPER_ADMIN_ID) {
    const [botsCount, usersCount, revenueAgg] = await Promise.all([
      prisma.bot.count(),
      prisma.user.count(),
      prisma.bot.aggregate({ _sum: { totalRevenue: true } }),
    ]);
    await bot.api.sendMessage(
      chatId,
      `📊 إحصائيات المنصة:\nعدد البوتات: ${botsCount}\nعدد المستخدمين: ${usersCount}\nأرباح المنصة التراكمية: ${fmt(Number(revenueAgg._sum.totalRevenue || 0))}`,
      { reply_markup: MAIN_MENU }
    );
    return;
  }
  // Admin plain-text withdrawal approval: "موافقة <id>" / "رفض <id>"
  if (tgUserId === SUPER_ADMIN_ID && (text.startsWith("موافقة ") || text.startsWith("رفض "))) {
    const approve = text.startsWith("موافقة ");
    const idSuffix = text.split(" ")[1]?.trim();
    if (idSuffix) await decideWithdrawal(bot, chatId, idSuffix, approve);
    return;
  }

  // --- Platform-picker (disambiguated by pendingAction.intent) ---
  if (pending?.mode === "platform_pick" && LABEL_TO_TYPE[text]) {
    const type = LABEL_TO_TYPE[text];
    if (pending.intent === "watch") {
      await setPending(user.id, null);
      await sendWatchList(bot, chatId, tgUserId, type);
      return;
    }
    const steps = createAdSteps(type);
    await setPending(user.id, { mode: "create_ad", type, step: steps[0], collected: {} });
    await askCreateAdStep(bot, chatId, type, steps[0]);
    return;
  }

  if (pending?.mode === "admin_global_ad_platform" && LABEL_TO_TYPE[text] && tgUserId === SUPER_ADMIN_ID) {
    const type = LABEL_TO_TYPE[text];
    await setPending(user.id, { mode: "admin_global_ad_target", type });
    await bot.api.sendMessage(chatId, "أرسل الرابط/الحساب الذي تريد الترويج له:", { reply_markup: AMOUNT_ENTRY_MENU });
    return;
  }
  if (pending?.mode === "admin_global_ad_target" && tgUserId === SUPER_ADMIN_ID) {
    await createGlobalAd(bot, chatId, user, pending.type, text);
    return;
  }

  if (pending?.mode === "create_ad" && pending.step === "subtype" && (text === "🔁 إعادة تغريد" || text === "➕ متابعة")) {
    const subType: "retweet" | "follow" = text === "🔁 إعادة تغريد" ? "retweet" : "follow";
    const collected = { ...pending.collected, subType };
    const next = nextCreateAdStep(pending.type, "subtype")!;
    await setPending(user.id, { mode: "create_ad", type: pending.type, step: next as any, collected });
    await askCreateAdStep(bot, chatId, pending.type, next);
    return;
  }

  if (pending?.mode === "reviewing_ad" && (text === "✅ تأكيد الإرسال" || text === "❌ إلغاء")) {
    if (text === "❌ إلغاء") {
      await setPending(user.id, null);
      await bot.api.sendMessage(chatId, "أُلغيت الحملة.", { reply_markup: MAIN_MENU });
      return;
    }
    await confirmAd(bot, chatId, user, pending);
    return;
  }

  // Per-task confirm: "✅ <shortId>"
  if (text.startsWith("✅ ") && text.length <= 10) {
    await completeTaskBySuffix(bot, chatId, tgUserId, text.slice(2).trim());
    return;
  }

  if (pending?.mode === "create_ad") {
    await consumeCreateAdStep(bot, chatId, user, pending, text);
    return;
  }
  if (pending?.mode === "withdraw") {
    await consumeWithdrawAmount(bot, chatId, user, text);
    return;
  }
  if (pending?.mode === "admin_broadcast" && tgUserId === SUPER_ADMIN_ID) {
    await runBroadcast(bot, chatId, text);
    await setPending(user.id, null);
    return;
  }

  await bot.api.sendMessage(chatId, "يرجى الاختيار من القائمة السفلية فقط.", { reply_markup: MAIN_MENU });
}

async function consumeCreateAdStep(bot: TelegramBot, chatId: number, user: any, pending: Extract<PendingAction, { mode: "create_ad" }>, text: string) {
  const { type, step, collected } = pending;
  const updated = { ...collected };

  if (step === "description") {
    if (!text) {
      await bot.api.sendMessage(chatId, "أرسل وصفاً غير فارغ.");
      return;
    }
    updated.description = text;
  } else if (step === "target") {
    updated.target = text;
  } else if (step === "budget") {
    const budget = Number(text.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(budget) || budget <= 0) {
      await bot.api.sendMessage(chatId, "أرسل رقماً صحيحاً أكبر من صفر بالدولار.");
      return;
    }
    updated.budget = budget;
  } else if (step === "cpc") {
    const cpc = Number(text.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(cpc) || cpc < MIN_CPC) {
      await bot.api.sendMessage(chatId, `السعر لكل نقرة لا يقل عن $${MIN_CPC}.`);
      return;
    }
    if (updated.budget && cpc > updated.budget) {
      await bot.api.sendMessage(chatId, "السعر لكل نقرة أكبر من الميزانية الكلية.");
      return;
    }
    updated.cpc = cpc;
  }

  const next = nextCreateAdStep(type, step);
  if (!next) {
    await setPending(user.id, { mode: "reviewing_ad", type, collected: updated });
    await sendAdReview(bot, chatId, type, updated);
    return;
  }
  await setPending(user.id, { mode: "create_ad", type, step: next, collected: updated });
  await askCreateAdStep(bot, chatId, type, next);
}

function createAdSteps(type: AdTypeStr): Array<"subtype" | "description" | "target" | "budget" | "cpc"> {
  const s: Array<"subtype" | "description" | "target" | "budget" | "cpc"> = [];
  if (type === "TWITTER") s.push("subtype");
  if (NEEDS_DESCRIPTION.includes(type)) s.push("description");
  s.push("target", "budget", "cpc");
  return s;
}
function nextCreateAdStep(type: AdTypeStr, current: string) {
  const seq = createAdSteps(type);
  const idx = seq.indexOf(current as any);
  return seq[idx + 1] || null;
}

async function askCreateAdStep(bot: TelegramBot, chatId: number, type: AdTypeStr, step: string) {
  if (step === "subtype") {
    await bot.api.sendMessage(chatId, "اختر نوع مهمة تويتر:", { reply_markup: TWITTER_SUBTYPE_MENU });
    return;
  }
  const prompts: Record<string, string> = {
    description: "أرسل وصف حملتك (نص قصير يظهر للمستخدمين):",
    target: "أرسل الرابط/الحساب/القناة الذي تريد الترويج له:",
    budget: "حدد ميزانية حملتك بالدولار (مثال: 100):",
    cpc: `حدد السعر لكل نقرة/مهمة بالدولار (الحد الأدنى $${MIN_CPC}):`,
  };
  await bot.api.sendMessage(chatId, prompts[step], { reply_markup: AMOUNT_ENTRY_MENU });
}

async function sendAdReview(bot: TelegramBot, chatId: number, type: AdTypeStr, c: CreateAdCollected) {
  const clicks = Math.floor((c.budget || 0) / (c.cpc || MIN_CPC));
  const lines = [
    `مراجعة حملتك — ${TYPE_LABEL[type]}`,
    c.subType ? `النوع: ${c.subType === "retweet" ? "إعادة تغريد" : "متابعة"}` : null,
    c.description ? `الوصف: ${c.description}` : null,
    `الهدف: ${c.target}`,
    `الميزانية: ${fmt(c.budget || 0)}`,
    `سعر النقرة: ${fmt(c.cpc || 0)}`,
    `عدد النقرات المتوقع: ~${clicks}`,
  ].filter(Boolean);
  await bot.api.sendMessage(chatId, lines.join("\n"), { reply_markup: REVIEW_MENU });
}

async function consumeWithdrawAmount(bot: TelegramBot, chatId: number, user: any, text: string) {
  const amount = Number(text.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
    await bot.api.sendMessage(chatId, `الحد الأدنى للسحب $${MIN_WITHDRAWAL}. أرسل رقماً صحيحاً.`);
    return;
  }
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  const balance = Number(fresh?.balance || 0);
  if (amount > balance) {
    await bot.api.sendMessage(chatId, `رصيدك ${fmt(balance)} فقط.`);
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { balance: round2(balance - amount) } });
  const tx = await prisma.transaction.create({ data: { userId: user.id, amount: round2(amount), currency: "internal", type: "WITHDRAWAL", status: "PENDING" } });
  await setPending(user.id, null);
  await bot.api.sendMessage(chatId, `تم إرسال طلب سحب ${fmt(amount)}. سيُراجَع من مالك المنصة.`, { reply_markup: MAIN_MENU });

  if (SUPER_ADMIN_ID) {
    await bot.api
      .sendMessage(
        Number(SUPER_ADMIN_ID),
        `طلب سحب جديد\nمستخدم: ${user.id}\nالمبلغ: ${fmt(amount)}\n\nللموافقة أرسل: موافقة ${shortId(tx.id)}\nللرفض أرسل: رفض ${shortId(tx.id)}`
      )
      .catch(() => null);
  }
}

async function runBroadcast(bot: TelegramBot, chatId: number, text: string) {
  const users = await prisma.user.findMany({ select: { id: true } });
  let sent = 0;
  let failed = 0;
  for (const u of users) {
    try {
      await bot.api.sendMessage(Number(u.id), text);
      sent++;
    } catch {
      failed++;
    }
  }
  await bot.api.sendMessage(chatId, `تم الإرسال: ${sent} نجح، ${failed} فشل.`, { reply_markup: MAIN_MENU });
}

async function createGlobalAd(bot: TelegramBot, chatId: number, user: any, type: AdTypeStr, target: string) {
  await prisma.ad.create({
    data: {
      userId: SUPER_ADMIN_ID,
      botId: user.botId,
      type: type as any,
      content: target,
      totalBudget: 0,
      cpc: 0,
      ownerCut: 0,
      creatorCut: 0,
      workerCut: 0,
      remaining: Number.MAX_SAFE_INTEGER,
      status: "ACTIVE",
    },
  });
  await setPending(user.id, null);
  await bot.api.sendMessage(chatId, "✅ تم إضافة الإعلان الإجباري. سيظهر ضمن «شاهد واربح» لكل البوتات (بلا مكافأة، ترويج مجاني للمنصة).", { reply_markup: MAIN_MENU });
}

async function sendWatchList(bot: TelegramBot, chatId: number, tgUserId: string, type: AdTypeStr) {
  const ads = await prisma.ad.findMany({
    where: { type: type as any, status: "ACTIVE", remaining: { gte: 0 }, userId: { not: tgUserId } },
    orderBy: { created_at: "desc" },
    take: 10,
  });
  const usable = ads.filter((a) => a.cpc === 0 || Number(a.remaining) >= Number(a.cpc));
  if (usable.length === 0) {
    await bot.api.sendMessage(chatId, "لا حملات متاحة على هذه المنصة حالياً.", { reply_markup: MAIN_MENU });
    return;
  }

  const claimable = usable.filter((a) => Number(a.cpc) > 0);
  for (const ad of usable) {
    const isForced = Number(ad.cpc) === 0;
    const isTelegram = ad.type === "TELEGRAM";
    const openLink = isTelegram ? `https://t.me/${ad.content.replace(/^@/, "")}` : ad.content;
    const label = isForced ? "🌟 عرض من المنصة" : `${TYPE_LABEL[type]}\nالمكافأة: ${fmt(Number(ad.workerCut))}`;
    const confirmLine = isForced ? "" : `\nللتأكيد بعد إتمام المهمة، اضغط الزر: ✅ ${shortId(ad.id)}`;
    await bot.api.sendMessage(chatId, `${label}\nالرابط: ${openLink}${confirmLine}`);
  }

  if (claimable.length > 0) {
    const kb = new Keyboard();
    claimable.forEach((ad, i) => {
      kb.text(`✅ ${shortId(ad.id)}`);
      if (i % 2 === 1) kb.row();
    });
    if (claimable.length % 2 === 1) kb.row();
    kb.text(BACK);
    await bot.api.sendMessage(chatId, "اضغط زر التأكيد المطابق بعد إتمام المهمة:", { reply_markup: kb.resized() });
  } else {
    await bot.api.sendMessage(chatId, "للرجوع:", { reply_markup: MAIN_MENU });
  }
}

async function completeTaskBySuffix(bot: TelegramBot, chatId: number, tgUserId: string, suffix: string) {
  const candidates = await prisma.ad.findMany({ where: { status: "ACTIVE" }, take: 200 });
  const ad = candidates.find((a) => shortId(a.id) === suffix);
  if (!ad) {
    await bot.api.sendMessage(chatId, "هذه المهمة لم تعد متاحة.", { reply_markup: MAIN_MENU });
    return;
  }
  await completeTask(bot, chatId, tgUserId, ad.id);
}

async function completeTask(bot: TelegramBot, chatId: number, tgUserId: string, adId: string) {
  const ad = await prisma.ad.findUnique({ where: { id: adId } });
  if (!ad || ad.status !== "ACTIVE" || Number(ad.remaining) < Number(ad.cpc)) {
    await bot.api.sendMessage(chatId, "هذه المهمة لم تعد متاحة.", { reply_markup: MAIN_MENU });
    return;
  }
  if (ad.userId === tgUserId) {
    await bot.api.sendMessage(chatId, "لا يمكنك إتمام حملتك الخاصة.", { reply_markup: MAIN_MENU });
    return;
  }
  if (ad.type === "TELEGRAM") {
    try {
      const member = await bot.api.getChatMember(ad.content, Number(tgUserId));
      if (!["creator", "administrator", "member"].includes(member.status)) {
        await bot.api.sendMessage(chatId, `لم يتم التحقق من انضمامك بعد إلى ${ad.content}. انضم ثم أعد المحاولة.`);
        return;
      }
    } catch {
      await bot.api.sendMessage(chatId, "تعذّر التحقق من العضوية. تأكد أن رابط القناة صحيح وأن البوت مشرف فيها.");
      return;
    }
  }

  try {
    await prisma.transaction.create({
      data: { userId: tgUserId, amount: Number(ad.workerCut), currency: "internal", type: "TASK_REWARD", status: "COMPLETED", txHash: `task_${adId}_${tgUserId}` },
    });
  } catch {
    await bot.api.sendMessage(chatId, "استفدت من هذه المهمة مسبقاً.", { reply_markup: MAIN_MENU });
    return;
  }

  const newRemaining = round2(Number(ad.remaining) - Number(ad.cpc));
  await prisma.ad.update({ where: { id: ad.id }, data: { remaining: newRemaining, status: newRemaining < Number(ad.cpc) ? "EXPIRED" : ad.status } });

  const worker = await prisma.user.upsert({ where: { id: tgUserId }, update: {}, create: { id: tgUserId, botId: ad.botId, role: "USER" } });
  const newBalance = round2(Number(worker.balance) + Number(ad.workerCut));
  await prisma.user.update({ where: { id: tgUserId }, data: { balance: newBalance } });

  await prisma.bot.update({ where: { id: ad.botId }, data: { ownerBalance: { increment: Number(ad.creatorCut) }, totalRevenue: { increment: Number(ad.ownerCut) } } });

  await bot.api.sendMessage(chatId, `أُضيف ${fmt(Number(ad.workerCut))}! رصيدك الآن: ${fmt(newBalance)}.`, { reply_markup: MAIN_MENU });
}

async function confirmAd(bot: TelegramBot, chatId: number, user: any, pending: Extract<PendingAction, { mode: "reviewing_ad" }>) {
  const { type, collected } = pending;
  const budget = Number(collected.budget || 0);
  const cpc = Number(collected.cpc || 0);
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  const balance = Number(fresh?.balance || 0);
  if (budget > balance) {
    await bot.api.sendMessage(chatId, `الميزانية ${fmt(budget)} أكبر من رصيدك (${fmt(balance)}). أودع رصيداً أولاً من «المحفظة».`, { reply_markup: REVIEW_MENU });
    return;
  }
  const { ownerCut, creatorCut, workerCut } = splitCpc(cpc);
  await prisma.ad.create({
    data: {
      userId: user.id,
      botId: fresh!.botId,
      type: type as any,
      content: collected.target || "",
      totalBudget: budget,
      cpc,
      ownerCut,
      creatorCut,
      workerCut,
      remaining: budget,
      status: "ACTIVE",
    },
  });
  await prisma.user.update({ where: { id: user.id }, data: { balance: round2(balance - budget) } });
  await prisma.transaction.create({ data: { userId: user.id, amount: budget, currency: "internal", type: "AD_PAYMENT", status: "COMPLETED" } });
  await setPending(user.id, null);
  await bot.api.sendMessage(chatId, `تم إطلاق حملتك (خُصم ${fmt(budget)}). ستظهر الآن في «شاهد واربح» لكل المستخدمين.`, { reply_markup: MAIN_MENU });
}

async function sendStats(bot: TelegramBot, chatId: number, userId: string) {
  const [adsCreated, spent, earned, tasksCompleted] = await Promise.all([
    prisma.ad.count({ where: { userId } }),
    prisma.transaction.aggregate({ where: { userId, type: "AD_PAYMENT" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, type: "TASK_REWARD" }, _sum: { amount: true } }),
    prisma.transaction.count({ where: { userId, type: "TASK_REWARD" } }),
  ]);
  await bot.api.sendMessage(
    chatId,
    `📊 إحصائياتك:\nحملات أنشأتها: ${adsCreated}\nإجمالي الصرف: ${fmt(Number(spent._sum.amount || 0))}\nمهام أتممتها: ${tasksCompleted}\nإجمالي أرباحك: ${fmt(Number(earned._sum.amount || 0))}`,
    { reply_markup: MAIN_MENU }
  );
}

// Bot creator's own commission — gated to the bot's registered ownerId
// (config.creator_tg_id equivalent from the previous system, here just
// hosted_bots... i.e. Bot.ownerId directly, since Prisma's Bot model
// already carries it).
async function sendCreatorEarnings(bot: TelegramBot, chatId: number, botRow: BotRow, user: any) {
  if (user.id !== botRow.ownerId) {
    await bot.api.sendMessage(chatId, "هذا القسم مخصَّص لمنشئ البوت فقط.", { reply_markup: MAIN_MENU });
    return;
  }
  const fresh = await prisma.bot.findUnique({ where: { id: botRow.id } });
  await bot.api.sendMessage(
    chatId,
    `💼 أرباحك كمنشئ هذا البوت: ${fmt(Number(fresh?.ownerBalance || 0))}\n(20% من كل نقرة مكتملة على حملات هذا البوت)`,
    { reply_markup: MAIN_MENU }
  );
}

async function decideWithdrawal(bot: TelegramBot, chatId: number, txIdSuffix: string, approve: boolean) {
  const candidates = await prisma.transaction.findMany({ where: { status: "PENDING", type: "WITHDRAWAL" }, take: 200 });
  const tx = candidates.find((t) => shortId(t.id) === txIdSuffix);
  if (!tx) {
    await bot.api.sendMessage(chatId, "الطلب غير موجود أو عولج مسبقاً.");
    return;
  }
  if (approve) {
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: "COMPLETED" } });
    await bot.api.sendMessage(chatId, "✅ تمت الموافقة — حوّل المبلغ يدوياً للمستخدم.");
  } else {
    const user = await prisma.user.findUnique({ where: { id: tx.userId } });
    await prisma.user.update({ where: { id: tx.userId }, data: { balance: round2(Number(user?.balance || 0) + Number(tx.amount)) } });
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: "FAILED" } });
    await bot.api.sendMessage(chatId, "❌ رُفض الطلب وأُعيد المبلغ للمستخدم.");
  }
}

async function sendDepositOptions(bot: TelegramBot, chatId: number, userId: string) {
  const link = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app").replace(/\/$/, "")}/pay?uid=${userId}`;
  await bot.api.sendMessage(chatId, `اختر مبلغ الإيداع وعملتك المفضّلة (USDT, TRX, TON, LTC, SOL...) في الصفحة:\n${link}`, { reply_markup: WALLET_MENU });
}
