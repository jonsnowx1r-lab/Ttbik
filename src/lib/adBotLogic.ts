import { Bot as TelegramBot, Keyboard } from "grammy";
import { prisma } from "@/lib/prisma";
import type { Bot as BotRow } from "@prisma/client";
import { t, type Lang, DEFAULT_LANG } from "@/lib/i18n";

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
 *
 * i18n: end-user screens are AR/EN via src/lib/i18n.ts, persisted on
 * User.language. The Super Admin panel stays Arabic-only — a single-
 * operator surface, not worth doubling for.
 */

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || "";
const MIN_WITHDRAWAL = 1;

type AdTypeStr = "LINK" | "TELEGRAM" | "YOUTUBE" | "TWITTER" | "TIKTOK" | "FACEBOOK" | "INSTAGRAM";
const AD_TYPES: AdTypeStr[] = ["LINK", "TELEGRAM", "YOUTUBE", "TWITTER", "TIKTOK", "FACEBOOK", "INSTAGRAM"];
const TYPE_LABEL: Record<AdTypeStr, { ar: string; en: string }> = {
  LINK: { ar: "🌐 رابط", en: "🌐 Link" },
  TELEGRAM: { ar: "✈️ تلجرام", en: "✈️ Telegram" },
  YOUTUBE: { ar: "▶️ يوتيوب", en: "▶️ YouTube" },
  TWITTER: { ar: "🐦 تويتر/X", en: "🐦 Twitter/X" },
  TIKTOK: { ar: "🎵 تيك توك", en: "🎵 TikTok" },
  FACEBOOK: { ar: "📘 فيسبوك", en: "📘 Facebook" },
  INSTAGRAM: { ar: "📸 انستغرام", en: "📸 Instagram" },
};
// Matches either language's label back to a platform, regardless of which
// language the user is currently viewing (covers the moment right after a
// language switch too).
const LABEL_TO_TYPE: Record<string, AdTypeStr> = Object.fromEntries(
  AD_TYPES.flatMap((t) => [
    [TYPE_LABEL[t].ar, t],
    [TYPE_LABEL[t].en, t],
  ])
) as Record<string, AdTypeStr>;
const NEEDS_DESCRIPTION: AdTypeStr[] = ["YOUTUBE", "TIKTOK", "FACEBOOK", "INSTAGRAM"];

// A flat $0.02 minimum overprices cheap actions (joining a channel) relative
// to costlier ones (watching a full video) — per-platform floors, from the
// owner's fair-pricing-table spec (2026-08-31). FACEBOOK/TIKTOK weren't in
// that table; given the same default as INSTAGRAM/TWITTER (comparable
// follow/engagement actions) rather than inventing an unrequested number.
const MIN_CPC_BY_TYPE: Record<AdTypeStr, number> = {
  LINK: 0.005,
  TELEGRAM: 0.003,
  YOUTUBE: 0.01,
  TWITTER: 0.005,
  INSTAGRAM: 0.005,
  FACEBOOK: 0.005,
  TIKTOK: 0.005,
};

type AdScope = "TARGETED" | "GLOBAL";
type CreateAdCollected = { scope?: AdScope; subType?: "retweet" | "follow"; description?: string; target?: string; budget?: number; cpc?: number };
type CreateAdStep = "scope" | "subtype" | "description" | "target" | "budget" | "cpc";
type PendingAction =
  | { mode: "platform_pick"; intent: "watch" | "create" }
  | { mode: "create_ad"; type: AdTypeStr; step: CreateAdStep; collected: CreateAdCollected }
  | { mode: "reviewing_ad"; type: AdTypeStr; collected: CreateAdCollected }
  | { mode: "withdraw" }
  | { mode: "choosing_language" }
  | { mode: "admin_broadcast" }
  | { mode: "admin_global_ad_platform" }
  | { mode: "admin_global_ad_target"; type: AdTypeStr }
  | { mode: "admin_credit_target" }
  | { mode: "admin_credit_amount"; targetId: string }
  | { mode: "owner_broadcast" }
  | { mode: "owner_channel_setup" }
  | { mode: "owner_withdraw_address" }
  | { mode: "owner_withdraw_amount"; address: string };

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
function asLang(v: unknown): Lang {
  return v === "en" ? "en" : DEFAULT_LANG;
}

async function isChannelMember(bot: TelegramBot, channelHandle: string, tgUserId: string): Promise<boolean> {
  try {
    const handle = channelHandle.startsWith("@") ? channelHandle : `@${channelHandle}`;
    const member = await bot.api.getChatMember(handle, Number(tgUserId));
    return ["creator", "administrator", "member"].includes(member.status);
  } catch {
    return false;
  }
}

// --- Reply keyboards (pinned bottom button grid) — all language-aware ---
function backLabel(lang: Lang) {
  return t(lang, "btnBack");
}

function mainMenu(lang: Lang): Keyboard {
  return new Keyboard()
    .text(t(lang, "btnCreateAd")).text(t(lang, "btnWatchEarn")).row()
    .text(t(lang, "btnWallet")).text(t(lang, "btnReferrals")).row()
    .text(t(lang, "btnStats")).text(t(lang, "btnLanguage")).row()
    .text(t(lang, "btnFaq")).row()
    .resized();
}
function walletMenu(lang: Lang): Keyboard {
  return new Keyboard().text(t(lang, "btnDeposit")).text(t(lang, "btnWithdraw")).row().text(backLabel(lang)).resized();
}
function typeMenu(lang: Lang): Keyboard {
  const kb = new Keyboard();
  AD_TYPES.forEach((type, i) => {
    kb.text(TYPE_LABEL[type][lang]);
    if (i % 2 === 1) kb.row();
  });
  if (AD_TYPES.length % 2 === 1) kb.row();
  kb.text(backLabel(lang));
  return kb.resized();
}
function twitterSubtypeMenu(lang: Lang): Keyboard {
  return new Keyboard().text(t(lang, "btnRetweet")).text(t(lang, "btnFollow")).row().text(backLabel(lang)).resized();
}
function reviewMenu(lang: Lang): Keyboard {
  return new Keyboard().text(t(lang, "btnConfirmSend")).text(t(lang, "btnCancel")).resized();
}
function reviewInsufficientMenu(lang: Lang): Keyboard {
  return new Keyboard().text(t(lang, "btnDepositNow")).row().text(t(lang, "btnConfirmSend")).text(t(lang, "btnCancel")).resized();
}
function amountEntryMenu(lang: Lang): Keyboard {
  return new Keyboard().text(backLabel(lang)).resized();
}
function languageMenu(lang: Lang): Keyboard {
  return new Keyboard().text(t(lang, "btnLangAr")).text(t(lang, "btnLangEn")).row().text(backLabel(lang)).resized();
}
function scopeMenu(lang: Lang): Keyboard {
  return new Keyboard().text(t(lang, "btnScopeTargeted")).row().text(t(lang, "btnScopeGlobal")).row().text(backLabel(lang)).resized();
}
const ADMIN_MENU = new Keyboard()
  .text("📢 إعلان إجباري شامل").row()
  .text("📣 إذاعة لكل المستخدمين").row()
  .text("📊 الإحصائيات والأرباح").row()
  .text("➕ شحن رصيد").row()
  .text("🔙 القائمة الرئيسية")
  .resized();
// Bot Owner panel is Arabic-only for now too (like the Super Admin panel) —
// a scope call given the size of this build; can be translated later if a
// non-Arabic-speaking bot creator actually needs it.
const OWNER_MENU = new Keyboard()
  .text("💼 أرباحي والسحب").row()
  .text("📊 إحصائيات البوت").row()
  .text("📣 إذاعة لمستخدمي البوت").row()
  .text("📢 قناة الاشتراك الإجباري").row()
  .text("🔙 القائمة الرئيسية")
  .resized();

function topLevelTexts(lang: Lang): string[] {
  return [t(lang, "btnCreateAd"), t(lang, "btnWatchEarn"), t(lang, "btnWallet"), t(lang, "btnReferrals"), t(lang, "btnStats"), t(lang, "btnLanguage"), t(lang, "btnFaq")];
}
function isBack(lang: Lang, text: string): boolean {
  return text === t("ar", "btnBack") || text === t("en", "btnBack");
}

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
    const lang = asLang(user.language);
    const isPrivileged = tgUserId === SUPER_ADMIN_ID || tgUserId === botRow.ownerId;
    if (!isPrivileged && botRow.requiredChannel) {
      const joined = await isChannelMember(bot, botRow.requiredChannel, tgUserId);
      if (!joined) {
        await bot.api.sendMessage(
          chatId,
          `📢 قبل استخدام البوت، انضم إلى القناة التالية ثم أرسل /start مجدداً:\nhttps://t.me/${botRow.requiredChannel.replace(/^@/, "")}`
        );
        return;
      }
    }
    const adminNote = tgUserId === SUPER_ADMIN_ID ? t(lang, "adminNote") : tgUserId === botRow.ownerId ? "\n\n🛠 أنت منشئ هذا البوت — أرسل /admin لفتح لوحة تحكمك." : "";
    await bot.api.sendMessage(chatId, `${t(lang, "welcome")}${adminNote}`, { reply_markup: mainMenu(lang) });
    return;
  }

  if (text === "/admin") {
    if (tgUserId === botRow.ownerId && tgUserId !== SUPER_ADMIN_ID) {
      const fresh = await prisma.bot.findUnique({ where: { id: botRow.id } });
      await bot.api.sendMessage(chatId, `🛠 لوحة تحكم منشئ البوت\n\nرصيد أرباحك الجاهز للسحب: ${fmt(Number(fresh?.ownerBalance || 0))}`, { reply_markup: OWNER_MENU });
      return;
    }
    if (tgUserId !== SUPER_ADMIN_ID) {
      await bot.api.sendMessage(chatId, "⛔ عذراً، هذا الأمر مخصص لمالك المنصة فقط.");
      return;
    }
    await bot.api.sendMessage(chatId, "🛠 لوحة تحكم المالك الأكبر", { reply_markup: ADMIN_MENU });
    return;
  }

  const user = await ensureUser(botRow.id, tgUserId, botRow);
  const lang = asLang(user.language);
  const pending = user.pendingAction as PendingAction | null;

  // Universal back button (either language's label).
  if (isBack(lang, text)) {
    await setPending(user.id, null);
    await bot.api.sendMessage(chatId, t(lang, "mainMenuTitle"), { reply_markup: mainMenu(lang) });
    return;
  }

  if (topLevelTexts(lang).includes(text) && pending) {
    await setPending(user.id, null);
  }

  if (text === t(lang, "btnCreateAd")) {
    await setPending(user.id, { mode: "platform_pick", intent: "create" });
    await bot.api.sendMessage(chatId, t(lang, "createAdTitle"), { reply_markup: typeMenu(lang) });
    return;
  }
  if (text === t(lang, "btnWatchEarn")) {
    await setPending(user.id, { mode: "platform_pick", intent: "watch" });
    await bot.api.sendMessage(chatId, t(lang, "choosePlatform"), { reply_markup: typeMenu(lang) });
    return;
  }
  if (text === t(lang, "btnWallet")) {
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    await bot.api.sendMessage(chatId, `${t(lang, "walletTitle")}\n\n${t(lang, "walletBalance", { balance: fmt(Number(fresh?.balance || 0)) })}`, { reply_markup: walletMenu(lang) });
    return;
  }
  if (text === t(lang, "btnReferrals")) {
    const me = await bot.api.getMe();
    await bot.api.sendMessage(chatId, t(lang, "referralLink", { link: `https://t.me/${me.username}?start=${user.id}` }), { reply_markup: mainMenu(lang) });
    return;
  }
  if (text === t(lang, "btnStats")) {
    await sendStats(bot, chatId, user.id, lang);
    return;
  }
  if (text === t(lang, "btnLanguage")) {
    await setPending(user.id, { mode: "choosing_language" });
    await bot.api.sendMessage(chatId, t(lang, "langCurrent"), { reply_markup: languageMenu(lang) });
    return;
  }
  if (pending?.mode === "choosing_language" && (text === t("ar", "btnLangAr") || text === t("en", "btnLangEn"))) {
    const newLang: Lang = text === t("en", "btnLangEn") ? "en" : "ar";
    await prisma.user.update({ where: { id: user.id }, data: { language: newLang, pendingAction: null as any } });
    await bot.api.sendMessage(chatId, t(newLang, "langSet"), { reply_markup: mainMenu(newLang) });
    return;
  }
  if (text === t(lang, "btnFaq")) {
    await bot.api.sendMessage(chatId, t(lang, "faqBody"), { reply_markup: mainMenu(lang) });
    return;
  }
  if (text === t(lang, "btnDeposit")) {
    await sendDepositOptions(bot, chatId, user.id, lang);
    return;
  }
  if (text === t(lang, "btnWithdraw")) {
    await setPending(user.id, { mode: "withdraw" });
    await bot.api.sendMessage(chatId, t(lang, "withdrawAmountPrompt", { min: MIN_WITHDRAWAL }), { reply_markup: amountEntryMenu(lang) });
    return;
  }

  // --- Super Admin menu (Arabic-only, single-operator surface) ---
  if (text === "📢 إعلان إجباري شامل" && tgUserId === SUPER_ADMIN_ID) {
    await setPending(user.id, { mode: "admin_global_ad_platform" });
    await bot.api.sendMessage(chatId, "اختر منصة الإعلان الإجباري:", { reply_markup: typeMenu("ar") });
    return;
  }
  if (text === "📣 إذاعة لكل المستخدمين" && tgUserId === SUPER_ADMIN_ID) {
    await setPending(user.id, { mode: "admin_broadcast" });
    await bot.api.sendMessage(chatId, "أرسل نص الرسالة التي ستصل لكل مستخدمي المنصة:", { reply_markup: amountEntryMenu("ar") });
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
      { reply_markup: ADMIN_MENU }
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
  if (text === "➕ شحن رصيد" && tgUserId === SUPER_ADMIN_ID) {
    await setPending(user.id, { mode: "admin_credit_target" });
    await bot.api.sendMessage(chatId, "أرسل آيدي تليجرام للمستخدم (أو التاجر/منشئ البوت) الذي تريد شحن رصيده:", { reply_markup: amountEntryMenu("ar") });
    return;
  }
  if (pending?.mode === "admin_credit_target" && tgUserId === SUPER_ADMIN_ID) {
    const targetId = text.replace(/\D/g, "");
    if (!targetId) {
      await bot.api.sendMessage(chatId, "أرسل آيدي رقمي صحيح.");
      return;
    }
    await setPending(user.id, { mode: "admin_credit_amount", targetId });
    await bot.api.sendMessage(chatId, `أرسل المبلغ بالدولار الذي تريد إضافته لرصيد ${targetId}:`, { reply_markup: amountEntryMenu("ar") });
    return;
  }
  if (pending?.mode === "admin_credit_amount" && tgUserId === SUPER_ADMIN_ID) {
    const amount = Number(text.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      await bot.api.sendMessage(chatId, "أرسل رقماً صحيحاً أكبر من صفر.");
      return;
    }
    const target = await prisma.user.upsert({
      where: { id: pending.targetId },
      update: { balance: { increment: round2(amount) } },
      create: { id: pending.targetId, botId: botRow.id, role: "USER", balance: round2(amount) },
    });
    await setPending(user.id, null);
    await bot.api.sendMessage(chatId, `✅ تمت إضافة ${fmt(amount)} لرصيد ${pending.targetId}. رصيده الآن: ${fmt(Number(target.balance))}.`, { reply_markup: ADMIN_MENU });
    await bot.api.sendMessage(Number(pending.targetId), `🎁 أضاف مالك المنصة ${fmt(amount)} لرصيدك! رصيدك الآن: ${fmt(Number(target.balance))}.`).catch(() => null);
    return;
  }

  // --- Bot Owner panel (Arabic-only, gated to this bot's registered ownerId) ---
  if (text === "💼 أرباحي والسحب" && tgUserId === botRow.ownerId) {
    const fresh = await prisma.bot.findUnique({ where: { id: botRow.id } });
    await setPending(user.id, { mode: "owner_withdraw_address" });
    await bot.api.sendMessage(
      chatId,
      `💼 رصيدك الجاهز للسحب: ${fmt(Number(fresh?.ownerBalance || 0))}\n\nأرسل عنوان محفظتك (USDT - شبكة TRC20) لطلب السحب:`,
      { reply_markup: amountEntryMenu("ar") }
    );
    return;
  }
  if (pending?.mode === "owner_withdraw_address" && tgUserId === botRow.ownerId) {
    const address = text.trim();
    if (address.length < 10) {
      await bot.api.sendMessage(chatId, "أرسل عنوان محفظة صالح (TRC20).");
      return;
    }
    await setPending(user.id, { mode: "owner_withdraw_amount", address });
    await bot.api.sendMessage(chatId, "أرسل المبلغ بالدولار الذي تريد سحبه:", { reply_markup: amountEntryMenu("ar") });
    return;
  }
  if (pending?.mode === "owner_withdraw_amount" && tgUserId === botRow.ownerId) {
    const amount = Number(text.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      await bot.api.sendMessage(chatId, t("ar", "withdrawMinError", { min: MIN_WITHDRAWAL }));
      return;
    }
    const fresh = await prisma.bot.findUnique({ where: { id: botRow.id } });
    const ownerBalance = Number(fresh?.ownerBalance || 0);
    if (amount > ownerBalance) {
      await bot.api.sendMessage(chatId, `رصيدك الحالي ${fmt(ownerBalance)} فقط.`);
      return;
    }
    await prisma.bot.update({ where: { id: botRow.id }, data: { ownerBalance: round2(ownerBalance - amount) } });
    const tx = await prisma.transaction.create({
      data: { userId: user.id, botId: botRow.id, amount: round2(amount), currency: "internal", type: "OWNER_WITHDRAWAL", status: "PENDING" },
    });
    await setPending(user.id, null);
    await bot.api.sendMessage(
      chatId,
      `✅ تم إرسال طلب سحب ${fmt(amount)} إلى العنوان: ${pending.address}\nسيتم التحويل خلال 24-48 ساعة بعد المراجعة.`,
      { reply_markup: OWNER_MENU }
    );
    if (SUPER_ADMIN_ID) {
      await bot.api
        .sendMessage(
          Number(SUPER_ADMIN_ID),
          `طلب سحب أرباح منشئ بوت\nالبوت: ${botRow.id}\nالمالك: ${user.id}\nالمبلغ: ${fmt(amount)}\nالعنوان: ${pending.address}\n\nللموافقة أرسل: موافقة ${shortId(tx.id)}\nللرفض أرسل: رفض ${shortId(tx.id)}`
        )
        .catch(() => null);
    }
    return;
  }
  if (text === "📊 إحصائيات البوت" && tgUserId === botRow.ownerId) {
    const [usersCount, tasksCompleted, adsAgg] = await Promise.all([
      prisma.user.count({ where: { botId: botRow.id } }),
      prisma.transaction.count({ where: { botId: botRow.id, type: "TASK_REWARD" } }),
      prisma.ad.aggregate({ where: { botId: botRow.id }, _sum: { totalBudget: true } }),
    ]);
    await bot.api.sendMessage(
      chatId,
      `📊 إحصائيات بوتك:\nعدد المستخدمين: ${usersCount}\nعدد المهام المكتملة: ${tasksCompleted}\nإجمالي قيمة الإعلانات: ${fmt(Number(adsAgg._sum.totalBudget || 0))}`,
      { reply_markup: OWNER_MENU }
    );
    return;
  }
  if (text === "📣 إذاعة لمستخدمي البوت" && tgUserId === botRow.ownerId) {
    await setPending(user.id, { mode: "owner_broadcast" });
    await bot.api.sendMessage(chatId, "أرسل نص الرسالة التي ستصل لمستخدمي بوتك فقط:", { reply_markup: amountEntryMenu("ar") });
    return;
  }
  if (pending?.mode === "owner_broadcast" && tgUserId === botRow.ownerId) {
    const users = await prisma.user.findMany({ where: { botId: botRow.id }, select: { id: true } });
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
    await setPending(user.id, null);
    await bot.api.sendMessage(chatId, `تم الإرسال: ${sent} نجح، ${failed} فشل.`, { reply_markup: OWNER_MENU });
    return;
  }
  if (text === "📢 قناة الاشتراك الإجباري" && tgUserId === botRow.ownerId) {
    await setPending(user.id, { mode: "owner_channel_setup" });
    await bot.api.sendMessage(
      chatId,
      `القناة الحالية: ${botRow.requiredChannel || "غير مفعّلة"}\n\nأرسل معرف القناة (مثال: @MyChannel) لتفعيل الاشتراك الإجباري، أو أرسل "إلغاء" لإلغاء الاشتراك الإجباري:`,
      { reply_markup: amountEntryMenu("ar") }
    );
    return;
  }
  if (pending?.mode === "owner_channel_setup" && tgUserId === botRow.ownerId) {
    const cancel = text.trim() === "إلغاء";
    const channel = cancel ? null : text.trim().replace(/^@/, "");
    await prisma.bot.update({ where: { id: botRow.id }, data: { requiredChannel: channel } });
    await setPending(user.id, null);
    await bot.api.sendMessage(chatId, cancel ? "✅ تم إلغاء الاشتراك الإجباري." : `✅ تم تفعيل الاشتراك الإجباري في القناة @${channel}.`, { reply_markup: OWNER_MENU });
    return;
  }

  // --- Platform-picker (disambiguated by pendingAction.intent) ---
  if (pending?.mode === "platform_pick" && LABEL_TO_TYPE[text]) {
    const type = LABEL_TO_TYPE[text];
    if (pending.intent === "watch") {
      await setPending(user.id, null);
      await sendWatchList(bot, chatId, tgUserId, type, lang, botRow.id);
      return;
    }
    const steps = createAdSteps(type);
    await setPending(user.id, { mode: "create_ad", type, step: steps[0], collected: {} });
    await askCreateAdStep(bot, chatId, type, steps[0], lang);
    return;
  }

  if (pending?.mode === "create_ad" && pending.step === "scope" && (text === t(lang, "btnScopeTargeted") || text === t(lang, "btnScopeGlobal"))) {
    const scope: AdScope = text === t(lang, "btnScopeTargeted") ? "TARGETED" : "GLOBAL";
    const collected = { ...pending.collected, scope };
    const next = nextCreateAdStep(pending.type, "scope")!;
    await setPending(user.id, { mode: "create_ad", type: pending.type, step: next, collected });
    await askCreateAdStep(bot, chatId, pending.type, next, lang);
    return;
  }

  if (pending?.mode === "admin_global_ad_platform" && LABEL_TO_TYPE[text] && tgUserId === SUPER_ADMIN_ID) {
    const type = LABEL_TO_TYPE[text];
    await setPending(user.id, { mode: "admin_global_ad_target", type });
    await bot.api.sendMessage(chatId, "أرسل الرابط/الحساب الذي تريد الترويج له:", { reply_markup: amountEntryMenu("ar") });
    return;
  }
  if (pending?.mode === "admin_global_ad_target" && tgUserId === SUPER_ADMIN_ID) {
    await createGlobalAd(bot, chatId, user, pending.type, text);
    return;
  }

  if (pending?.mode === "create_ad" && pending.step === "subtype" && (text === t("ar", "btnRetweet") || text === t("en", "btnRetweet") || text === t("ar", "btnFollow") || text === t("en", "btnFollow"))) {
    const subType: "retweet" | "follow" = text === t("ar", "btnRetweet") || text === t("en", "btnRetweet") ? "retweet" : "follow";
    const collected = { ...pending.collected, subType };
    const next = nextCreateAdStep(pending.type, "subtype")!;
    await setPending(user.id, { mode: "create_ad", type: pending.type, step: next as any, collected });
    await askCreateAdStep(bot, chatId, pending.type, next, lang);
    return;
  }

  if (pending?.mode === "reviewing_ad" && text === t(lang, "btnDepositNow")) {
    await sendDepositOptions(bot, chatId, user.id, lang);
    await bot.api.sendMessage(chatId, t(lang, "adDepositThenConfirm"), { reply_markup: reviewInsufficientMenu(lang) });
    return;
  }
  if (pending?.mode === "reviewing_ad" && (text === t(lang, "btnConfirmSend") || text === t(lang, "btnCancel"))) {
    if (text === t(lang, "btnCancel")) {
      await setPending(user.id, null);
      await bot.api.sendMessage(chatId, t(lang, "adCancelled"), { reply_markup: mainMenu(lang) });
      return;
    }
    await confirmAd(bot, chatId, user, pending, lang);
    return;
  }

  // Per-task confirm: "✅ <shortId>"
  if (text.startsWith("✅ ") && text.length <= 10) {
    await completeTaskBySuffix(bot, chatId, tgUserId, text.slice(2).trim(), lang, botRow.id);
    return;
  }

  if (pending?.mode === "create_ad") {
    await consumeCreateAdStep(bot, chatId, user, pending, text, lang);
    return;
  }
  if (pending?.mode === "withdraw") {
    await consumeWithdrawAmount(bot, chatId, user, text, lang);
    return;
  }
  if (pending?.mode === "admin_broadcast" && tgUserId === SUPER_ADMIN_ID) {
    await runBroadcast(bot, chatId, text);
    await setPending(user.id, null);
    return;
  }

  await bot.api.sendMessage(chatId, t(lang, "chooseUnknown"), { reply_markup: mainMenu(lang) });
}

async function consumeCreateAdStep(bot: TelegramBot, chatId: number, user: any, pending: Extract<PendingAction, { mode: "create_ad" }>, text: string, lang: Lang) {
  const { type, step, collected } = pending;
  const updated = { ...collected };

  if (step === "description") {
    if (!text) {
      await bot.api.sendMessage(chatId, t(lang, "adDescriptionEmptyError"));
      return;
    }
    updated.description = text;
  } else if (step === "target") {
    updated.target = text;
  } else if (step === "budget") {
    const budget = Number(text.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(budget) || budget <= 0) {
      await bot.api.sendMessage(chatId, t(lang, "adBudgetError"));
      return;
    }
    updated.budget = budget;
  } else if (step === "cpc") {
    const cpc = Number(text.replace(/[^0-9.]/g, ""));
    const minCpc = MIN_CPC_BY_TYPE[type];
    if (!Number.isFinite(cpc) || cpc < minCpc) {
      await bot.api.sendMessage(chatId, t(lang, "adCpcMinError", { platform: TYPE_LABEL[type][lang], min: minCpc }));
      return;
    }
    if (updated.budget && cpc > updated.budget) {
      await bot.api.sendMessage(chatId, t(lang, "adCpcOverBudgetError"));
      return;
    }
    updated.cpc = cpc;
  }

  const next = nextCreateAdStep(type, step);
  if (!next) {
    await setPending(user.id, { mode: "reviewing_ad", type, collected: updated });
    await sendAdReview(bot, chatId, type, updated, lang);
    return;
  }
  await setPending(user.id, { mode: "create_ad", type, step: next, collected: updated });
  await askCreateAdStep(bot, chatId, type, next, lang);
}

function createAdSteps(type: AdTypeStr): CreateAdStep[] {
  const s: CreateAdStep[] = ["scope"];
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

async function askCreateAdStep(bot: TelegramBot, chatId: number, type: AdTypeStr, step: string, lang: Lang) {
  if (step === "scope") {
    await bot.api.sendMessage(chatId, t(lang, "adScopePrompt"), { reply_markup: scopeMenu(lang) });
    return;
  }
  if (step === "subtype") {
    await bot.api.sendMessage(chatId, t(lang, "adSubtypePrompt"), { reply_markup: twitterSubtypeMenu(lang) });
    return;
  }
  const prompts: Record<string, string> = {
    description: t(lang, "adDescriptionPrompt"),
    target: t(lang, "adTargetPrompt"),
    budget: t(lang, "adBudgetPrompt"),
    cpc: t(lang, "adCpcPrompt", { min: MIN_CPC_BY_TYPE[type] }),
  };
  await bot.api.sendMessage(chatId, prompts[step], { reply_markup: amountEntryMenu(lang) });
}

async function sendAdReview(bot: TelegramBot, chatId: number, type: AdTypeStr, c: CreateAdCollected, lang: Lang) {
  const clicks = Math.floor((c.budget || 0) / (c.cpc || MIN_CPC_BY_TYPE[type]));
  const lines = [
    t(lang, "adReviewTitle", { platform: TYPE_LABEL[type][lang] }),
    t(lang, "adReviewScope", { scope: c.scope === "GLOBAL" ? t(lang, "btnScopeGlobal") : t(lang, "btnScopeTargeted") }),
    c.subType ? t(lang, "adReviewType", { type: c.subType === "retweet" ? t(lang, "btnRetweet") : t(lang, "btnFollow") }) : null,
    c.description ? t(lang, "adReviewDesc", { desc: c.description }) : null,
    t(lang, "adReviewTarget", { target: c.target || "" }),
    t(lang, "adReviewBudget", { budget: fmt(c.budget || 0) }),
    t(lang, "adReviewCpc", { cpc: fmt(c.cpc || 0) }),
    t(lang, "adReviewClicks", { clicks }),
  ].filter(Boolean);
  await bot.api.sendMessage(chatId, lines.join("\n"), { reply_markup: reviewMenu(lang) });
}

async function consumeWithdrawAmount(bot: TelegramBot, chatId: number, user: any, text: string, lang: Lang) {
  const amount = Number(text.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
    await bot.api.sendMessage(chatId, t(lang, "withdrawMinError", { min: MIN_WITHDRAWAL }));
    return;
  }
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  const balance = Number(fresh?.balance || 0);
  if (amount > balance) {
    await bot.api.sendMessage(chatId, t(lang, "withdrawInsufficient", { balance: fmt(balance) }));
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { balance: round2(balance - amount) } });
  const tx = await prisma.transaction.create({ data: { userId: user.id, amount: round2(amount), currency: "internal", type: "WITHDRAWAL", status: "PENDING" } });
  await setPending(user.id, null);
  await bot.api.sendMessage(chatId, t(lang, "withdrawSent", { amount: fmt(amount) }), { reply_markup: mainMenu(lang) });

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
  await bot.api.sendMessage(chatId, `تم الإرسال: ${sent} نجح، ${failed} فشل.`, { reply_markup: ADMIN_MENU });
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
      scope: "GLOBAL",
      targetBotId: null,
    },
  });
  await setPending(user.id, null);
  await bot.api.sendMessage(chatId, "✅ تم إضافة الإعلان الإجباري. سيظهر ضمن «شاهد واربح» لكل البوتات (بلا مكافأة، ترويج مجاني للمنصة).", { reply_markup: ADMIN_MENU });
}

async function sendWatchList(bot: TelegramBot, chatId: number, tgUserId: string, type: AdTypeStr, lang: Lang, currentBotId: string) {
  // Pool = this bot's own TARGETED campaigns + the platform-wide GLOBAL pool
  // (forced platform ads are created with scope "GLOBAL" too, see
  // createGlobalAd, so they fall into the same OR branch automatically).
  const ads = await prisma.ad.findMany({
    where: {
      type: type as any,
      status: "ACTIVE",
      userId: { not: tgUserId },
      OR: [
        { scope: "TARGETED", botId: currentBotId },
        { scope: "GLOBAL" },
      ],
    },
    orderBy: { created_at: "desc" },
    take: 50,
  });

  // Already-completed-by-this-user ads are excluded via the same synthetic
  // txHash used for double-claim protection (`task_<adId>_<userId>`) — no
  // separate "completedTasks" relation exists in this schema, so we derive
  // it from Transaction directly instead.
  const doneTx = await prisma.transaction.findMany({
    where: { userId: tgUserId, type: "TASK_REWARD", txHash: { not: null } },
    select: { txHash: true },
  });
  const doneAdIds = new Set(
    doneTx
      .map((tx) => tx.txHash?.match(/^task_(.+)_[^_]+$/)?.[1])
      .filter((id): id is string => !!id)
  );

  const usable = ads
    .filter((a) => !doneAdIds.has(a.id))
    .filter((a) => a.cpc === 0 || Number(a.remaining) >= Number(a.cpc))
    .sort((a, b) => {
      // This bot's own campaigns first, then the global pool; within each
      // group, highest-paying first.
      const aOwn = a.botId === currentBotId ? 0 : 1;
      const bOwn = b.botId === currentBotId ? 0 : 1;
      if (aOwn !== bOwn) return aOwn - bOwn;
      return Number(b.cpc) - Number(a.cpc);
    })
    .slice(0, 10);
  if (usable.length === 0) {
    await bot.api.sendMessage(chatId, t(lang, "watchNoAds"), { reply_markup: mainMenu(lang) });
    return;
  }

  const claimable = usable.filter((a) => Number(a.cpc) > 0);
  for (const ad of usable) {
    const isForced = Number(ad.cpc) === 0;
    const isTelegram = ad.type === "TELEGRAM";
    const openLink = isTelegram ? `https://t.me/${ad.content.replace(/^@/, "")}` : ad.content;
    const label = isForced ? t(lang, "watchForcedLabel") : t(lang, "watchAdLabel", { platform: TYPE_LABEL[type][lang], reward: fmt(Number(ad.workerCut)) });
    const confirmLine = isForced ? "" : t(lang, "watchConfirmLine", { id: shortId(ad.id) });
    await bot.api.sendMessage(chatId, `${label}${t(lang, "watchLinkLine", { link: openLink })}${confirmLine}`);
  }

  if (claimable.length > 0) {
    const kb = new Keyboard();
    claimable.forEach((ad, i) => {
      kb.text(`✅ ${shortId(ad.id)}`);
      if (i % 2 === 1) kb.row();
    });
    if (claimable.length % 2 === 1) kb.row();
    kb.text(backLabel(lang));
    await bot.api.sendMessage(chatId, t(lang, "watchTapConfirm"), { reply_markup: kb.resized() });
  } else {
    await bot.api.sendMessage(chatId, t(lang, "watchBackOnly"), { reply_markup: mainMenu(lang) });
  }
}

async function completeTaskBySuffix(bot: TelegramBot, chatId: number, tgUserId: string, suffix: string, lang: Lang, currentBotId: string) {
  const candidates = await prisma.ad.findMany({ where: { status: "ACTIVE" }, take: 200 });
  const ad = candidates.find((a) => shortId(a.id) === suffix);
  if (!ad) {
    await bot.api.sendMessage(chatId, t(lang, "taskGone"), { reply_markup: mainMenu(lang) });
    return;
  }
  await completeTask(bot, chatId, tgUserId, ad.id, lang, currentBotId);
}

async function completeTask(bot: TelegramBot, chatId: number, tgUserId: string, adId: string, lang: Lang, currentBotId: string) {
  const ad = await prisma.ad.findUnique({ where: { id: adId } });
  if (!ad || ad.status !== "ACTIVE" || Number(ad.remaining) < Number(ad.cpc)) {
    await bot.api.sendMessage(chatId, t(lang, "taskGone"), { reply_markup: mainMenu(lang) });
    return;
  }
  if (ad.userId === tgUserId) {
    await bot.api.sendMessage(chatId, t(lang, "taskOwnCampaign"), { reply_markup: mainMenu(lang) });
    return;
  }
  if (ad.type === "TELEGRAM") {
    try {
      const member = await bot.api.getChatMember(ad.content, Number(tgUserId));
      if (!["creator", "administrator", "member"].includes(member.status)) {
        await bot.api.sendMessage(chatId, t(lang, "taskNotJoined", { channel: ad.content }));
        return;
      }
    } catch {
      await bot.api.sendMessage(chatId, t(lang, "taskVerifyFailed"));
      return;
    }
  }

  // Ensure the FK targets of the atomic batch below exist first — upserting
  // inside prisma.$transaction([...]) isn't necessary for these two (they're
  // idempotent no-ops when the row already exists), only the actual balance
  // mutations need to be atomic together.
  await prisma.user.upsert({ where: { id: tgUserId }, update: {}, create: { id: tgUserId, botId: ad.botId, role: "USER" } });
  if (SUPER_ADMIN_ID) {
    await prisma.user.upsert({ where: { id: SUPER_ADMIN_ID }, update: {}, create: { id: SUPER_ADMIN_ID, botId: ad.botId, role: "SUPER_ADMIN" } });
  }

  const newRemaining = round2(Number(ad.remaining) - Number(ad.cpc));
  const workerCut = Number(ad.workerCut);
  const creatorCut = Number(ad.creatorCut);
  const ownerCut = Number(ad.ownerCut);

  // Atomic — the dedup guard (unique txHash) is the first operation, so a
  // double-claim rolls back every other write in this batch too, not just
  // the log row. Without $transaction here, a crash between steps could
  // leave the ad's budget decremented with no one actually paid, or the
  // reverse — a real risk once real money is on the line.
  let results;
  try {
    results = await prisma.$transaction([
      prisma.transaction.create({
        data: { userId: tgUserId, botId: currentBotId, amount: workerCut, currency: "internal", type: "TASK_REWARD", status: "COMPLETED", txHash: `task_${adId}_${tgUserId}` },
      }),
      prisma.ad.update({ where: { id: ad.id }, data: { remaining: newRemaining, status: newRemaining < Number(ad.cpc) ? "EXPIRED" : ad.status } }),
      prisma.user.update({ where: { id: tgUserId }, data: { balance: { increment: workerCut } } }),
      // Credited to the bot the click actually happened in, not necessarily
      // ad.botId (the creating bot) — matters for GLOBAL-scope ads, where
      // the 20% creator cut belongs to whichever bot brought the worker.
      prisma.bot.update({ where: { id: currentBotId }, data: { ownerBalance: { increment: creatorCut }, totalRevenue: { increment: ownerCut } } }),
      ...(SUPER_ADMIN_ID
        ? [prisma.transaction.create({ data: { userId: SUPER_ADMIN_ID, botId: currentBotId, amount: ownerCut, currency: "internal", type: "PLATFORM_PROFIT", status: "COMPLETED" } })]
        : []),
    ]);
  } catch {
    await bot.api.sendMessage(chatId, t(lang, "taskAlreadyClaimed"), { reply_markup: mainMenu(lang) });
    return;
  }

  const updatedWorker = results[2] as { balance: number };
  await bot.api.sendMessage(chatId, t(lang, "taskRewarded", { amount: fmt(workerCut), balance: fmt(Number(updatedWorker.balance)) }), { reply_markup: mainMenu(lang) });
}

async function confirmAd(bot: TelegramBot, chatId: number, user: any, pending: Extract<PendingAction, { mode: "reviewing_ad" }>, lang: Lang) {
  const { type, collected } = pending;
  const budget = Number(collected.budget || 0);
  const cpc = Number(collected.cpc || 0);
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  const balance = Number(fresh?.balance || 0);
  if (budget > balance) {
    const link = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app").replace(/\/$/, "")}/pay?uid=${user.id}`;
    await bot.api.sendMessage(chatId, t(lang, "adInsufficientBalance", { budget: fmt(budget), balance: fmt(balance), link }), { reply_markup: reviewInsufficientMenu(lang) });
    return;
  }
  const { ownerCut, creatorCut, workerCut } = splitCpc(cpc);
  const scope: AdScope = collected.scope === "GLOBAL" ? "GLOBAL" : "TARGETED";
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
      scope,
      targetBotId: scope === "TARGETED" ? fresh!.botId : null,
    },
  });
  await prisma.user.update({ where: { id: user.id }, data: { balance: round2(balance - budget) } });
  await prisma.transaction.create({ data: { userId: user.id, amount: budget, currency: "internal", type: "AD_PAYMENT", status: "COMPLETED" } });
  await setPending(user.id, null);
  await bot.api.sendMessage(chatId, t(lang, "adLaunched", { budget: fmt(budget) }), { reply_markup: mainMenu(lang) });
}

async function sendStats(bot: TelegramBot, chatId: number, userId: string, lang: Lang) {
  const [adsCreated, spent, earned, tasksCompleted] = await Promise.all([
    prisma.ad.count({ where: { userId } }),
    prisma.transaction.aggregate({ where: { userId, type: "AD_PAYMENT" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, type: "TASK_REWARD" }, _sum: { amount: true } }),
    prisma.transaction.count({ where: { userId, type: "TASK_REWARD" } }),
  ]);
  await bot.api.sendMessage(
    chatId,
    t(lang, "statsTitle", { ads: adsCreated, spent: fmt(Number(spent._sum.amount || 0)), tasks: tasksCompleted, earned: fmt(Number(earned._sum.amount || 0)) }),
    { reply_markup: mainMenu(lang) }
  );
}


async function decideWithdrawal(bot: TelegramBot, chatId: number, txIdSuffix: string, approve: boolean) {
  const candidates = await prisma.transaction.findMany({ where: { status: "PENDING", type: { in: ["WITHDRAWAL", "OWNER_WITHDRAWAL"] } }, take: 200 });
  const tx = candidates.find((c) => shortId(c.id) === txIdSuffix);
  if (!tx) {
    await bot.api.sendMessage(chatId, "الطلب غير موجود أو عولج مسبقاً.");
    return;
  }
  if (approve) {
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: "COMPLETED" } });
    await bot.api.sendMessage(chatId, "✅ تمت الموافقة — حوّل المبلغ يدوياً للمستفيد.");
  } else if (tx.type === "OWNER_WITHDRAWAL" && tx.botId) {
    // Refund goes back to the bot's withdrawable commission, not a user balance.
    const botRow = await prisma.bot.findUnique({ where: { id: tx.botId } });
    await prisma.bot.update({ where: { id: tx.botId }, data: { ownerBalance: round2(Number(botRow?.ownerBalance || 0) + Number(tx.amount)) } });
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: "FAILED" } });
    await bot.api.sendMessage(chatId, "❌ رُفض الطلب وأُعيد المبلغ لرصيد منشئ البوت.");
  } else {
    const user = await prisma.user.findUnique({ where: { id: tx.userId } });
    await prisma.user.update({ where: { id: tx.userId }, data: { balance: round2(Number(user?.balance || 0) + Number(tx.amount)) } });
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: "FAILED" } });
    await bot.api.sendMessage(chatId, "❌ رُفض الطلب وأُعيد المبلغ للمستخدم.");
  }
}

async function sendDepositOptions(bot: TelegramBot, chatId: number, userId: string, lang: Lang) {
  const link = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app").replace(/\/$/, "")}/pay?uid=${userId}`;
  await bot.api.sendMessage(chatId, t(lang, "depositChoose", { link }), { reply_markup: walletMenu(lang) });
}
