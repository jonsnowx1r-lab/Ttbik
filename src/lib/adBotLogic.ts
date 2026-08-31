import { Bot as TelegramBot, Keyboard, InlineKeyboard } from "grammy";
import { prisma } from "@/lib/prisma";
import type { Bot as BotRow, Prisma } from "@prisma/client";
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
 *
 * Panel scoping (owner instruction, 2026-08-31): SUPER_ADMIN's panel is
 * fully separate and exclusive — never the regular end-user menu, by their
 * own explicit choice ("أنا لست مستخدماً ولست منشئاً، أنا المالك"). A bot's
 * own creator is different: they're also a real participant in their own
 * bot, so ownerMainMenu() is the regular end-user menu with four extra
 * creator-only rows appended, not a separate exclusive screen.
 */

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || "";
const MIN_WITHDRAWAL = 1;
const MIN_OWNER_WITHDRAWAL = 5;
// Above this, a withdrawal still goes through the same SUPER_ADMIN
// موافقة/رفض approval — it's just tagged PENDING_AUDIT instead of PENDING
// so the admin sees it needs closer scrutiny (central-wallet protection).
const AUDIT_THRESHOLD = 20;
// Multi-account device-fingerprint gate: a fingerprint already tied to this
// many OTHER distinct accounts blocks a new account from verifying through
// it — basic anti-farming, not a hard ban (see User.multiAccountFlag).
const FINGERPRINT_DISTINCT_USER_LIMIT = 2;

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
  | { mode: "withdraw_address" }
  | { mode: "withdraw_amount"; address: string }
  | { mode: "choosing_language" }
  | { mode: "admin_broadcast" }
  | { mode: "admin_global_ad_platform" }
  | { mode: "admin_global_ad_target"; type: AdTypeStr }
  | { mode: "admin_credit_target" }
  | { mode: "admin_credit_amount"; targetId: string }
  | { mode: "owner_broadcast" }
  | { mode: "owner_channel_setup" }
  | { mode: "owner_withdraw_address" }
  | { mode: "owner_withdraw_amount"; address: string }
  | { mode: "watch_carousel"; type: AdTypeStr; queue: string[]; index: number };

// Per-platform inline "action" button label for the شاهد واربح carousel —
// exempted from the reply-keyboard-only rule per explicit owner instruction
// (2026-08-31): the carousel is InlineKeyboard-only, everything else in the
// bot stays reply-keyboard-only as before.
const CAROUSEL_ACTION_LABEL: Record<AdTypeStr, { ar: string; en: string }> = {
  LINK: { ar: "🔗 زيارة الموقع (15 ثانية)", en: "🔗 Visit site (15s)" },
  TELEGRAM: { ar: "📢 انضمام للقناة / المجموعة", en: "📢 Join channel/group" },
  YOUTUBE: { ar: "▶️ مشاهدة الفيديو / اشتراك", en: "▶️ Watch/Subscribe" },
  TWITTER: { ar: "🐤 متابعة الحساب", en: "🐤 Follow account" },
  TIKTOK: { ar: "🎵 متابعة الحساب", en: "🎵 Follow account" },
  FACEBOOK: { ar: "📘 متابعة الصفحة", en: "📘 Follow page" },
  INSTAGRAM: { ar: "📸 متابعة الحساب", en: "📸 Follow account" },
};

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

// Basic auto-moderation word filter — not exhaustive, a first-pass net for
// the obvious cases (adult content, drugs, gambling, scams). Anything past
// this is expected to reach the report/FLAGGED path instead.
const BANNED_WORDS = [
  "مخدرات",
  "قمار",
  "كازينو",
  "اباحي",
  "إباحي",
  "دعارة",
  "احتيال",
  "نصب",
  "porn",
  "xxx",
  "nude",
  "escort",
  "casino",
  "gambling",
  "drugs",
  "cocaine",
  "scam",
  "phishing",
];
function containsBannedWords(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((w) => lower.includes(w.toLowerCase()));
}

// Google Safe Browsing v4 — env-gated (skips silently, ad passes) when no
// key is configured, same pattern as NOWPayments being optional. Fails
// open on any network/API error rather than blocking a legitimate ad over
// an outage.
async function isLinkUnsafe(url: string): Promise<boolean> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "souqtools-ttbik", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
    });
    const data = await res.json().catch(() => null);
    return !!(data && Array.isArray(data.matches) && data.matches.length > 0);
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
// Telegram's native "share contact" reply-keyboard button — the phone
// verification gate. requestContact is a reply-keyboard-only capability
// (no inline equivalent exists), so this stays consistent with the rest of
// the bot's reply-keyboard-only rule.
function phoneRequestMenu(lang: Lang): Keyboard {
  return new Keyboard().requestContact(t(lang, "btnSharePhone")).row().text(backLabel(lang)).resized();
}
const ADMIN_MENU = new Keyboard()
  .text("📢 إعلان إجباري شامل").row()
  .text("📣 إذاعة لكل المستخدمين").row()
  .text("📊 الإحصائيات والأرباح").row()
  .text("➕ شحن رصيد").row()
  .text("🔙 القائمة الرئيسية")
  .resized();
// A bot's own creator is also a full participant in their own bot — not a
// separate, exclusive role — per owner instruction (2026-08-31): "لوحة
// المستخدم العادي هي ذاتها، أضف أزرار الأدمن المنشئ عليها، ولا تفصل
// وظائف لوحة المستخدم عن لوحة الأدمن." So the owner's keyboard is the
// regular end-user menu with four extra creator-only rows appended, not a
// standalone admin screen that locks them out of ضع إعلانك/شاهد واربح/
// المحفظة. The four extra rows stay Arabic-only (like the Super Admin
// panel) — can be translated later if a non-Arabic-speaking creator needs
// it. This does NOT apply to SUPER_ADMIN, whose panel stays fully separate
// per their own explicit instruction ("أنا لست مستخدماً ولست منشئاً").
function ownerMainMenu(lang: Lang): Keyboard {
  return new Keyboard()
    .text(t(lang, "btnCreateAd")).text(t(lang, "btnWatchEarn")).row()
    .text(t(lang, "btnWallet")).text(t(lang, "btnReferrals")).row()
    .text(t(lang, "btnStats")).text(t(lang, "btnLanguage")).row()
    .text(t(lang, "btnFaq")).row()
    .text("💼 أرباحي والسحب").row()
    .text("📊 إحصائيات البوت").row()
    .text("📣 إذاعة لمستخدمي البوت").row()
    .text("📢 قناة الاشتراك الإجباري")
    .resized();
}

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

// Shared by /start and /admin — the platform owner is recognized purely by
// SUPER_ADMIN_TELEGRAM_ID, everywhere, on any bot; they never see the
// regular end-user menu, not even for a moment.
async function sendSuperAdminPanel(bot: TelegramBot, chatId: number) {
  await bot.api.sendMessage(chatId, "🛠 لوحة تحكم المالك الأكبر", { reply_markup: ADMIN_MENU });
}

// Shared by /start and /admin — a bot's own creator (ctx.from.id === bot.ownerId)
// is recognized the same way, regardless of whether they type /admin or
// just /start. Sends the earnings/referral summary with the merged
// user+owner keyboard (ownerMainMenu) so they land back on a fully
// functional menu, not an admin-only dead end.
async function sendOwnerPanel(bot: TelegramBot, chatId: number, botRow: BotRow, lang: Lang) {
  const fresh = await prisma.bot.findUnique({ where: { id: botRow.id } });
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app").replace(/\/$/, "");
  await bot.api.sendMessage(
    chatId,
    `🛠 أنت منشئ هذا البوت\n\nرصيد أرباحك الجاهز للسحب: ${fmt(Number(fresh?.ownerBalance || 0))}\nرصيد قيد الحجز (48 ساعة): ${fmt(Number(fresh?.pendingBalance || 0))}\n\n🎁 رابط إحالة منشئي بوتات آخرين (تربح 5% من صافي أرباح المنصة من كل بوت يُفعَّل عبره):\n${site}/bots?ref=${botRow.ownerId}`,
    { reply_markup: ownerMainMenu(lang) }
  );
}

export async function handleAdBotUpdate(bot: TelegramBot, botRow: BotRow, update: any) {
  if (update.callback_query) {
    await handleCarouselCallback(bot, botRow, update.callback_query);
    return;
  }
  const msg = update.message;
  if (!msg?.from || !msg.chat) return;
  const chatId = msg.chat.id;
  const tgUserId = String(msg.from.id);

  // Phone-verification handshake — arrives as a contact-only message (no
  // text), so this has to be checked before the "no text, ignore" bailout
  // below.
  if (msg.contact) {
    const contactUser = await ensureUser(botRow.id, tgUserId, botRow);
    const contactLang = asLang(contactUser.language);
    if (String(msg.contact.user_id) === tgUserId) {
      await prisma.user.update({ where: { id: tgUserId }, data: { phoneNumber: msg.contact.phone_number, phoneVerified: true } });
      await bot.api.sendMessage(chatId, t(contactLang, "phoneVerified"), { reply_markup: mainMenu(contactLang) });
    } else {
      await bot.api.sendMessage(chatId, t(contactLang, "phoneMismatch"));
    }
    return;
  }

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
    // The platform owner (SUPER_ADMIN) and a bot's own creator are never
    // regular participants — /start routes them straight to their control
    // panel, never the end-user main menu (no "شاهد واربح"/"ضع إعلانك"
    // etc.), matching the same "recognized immediately by ID" rule as
    // /admin itself. Only an ordinary member sees the normal menu.
    if (tgUserId === SUPER_ADMIN_ID) {
      await sendSuperAdminPanel(bot, chatId);
      return;
    }
    if (tgUserId === botRow.ownerId) {
      await sendOwnerPanel(bot, chatId, botRow, lang);
      return;
    }
    await bot.api.sendMessage(chatId, t(lang, "welcome"), { reply_markup: mainMenu(lang) });
    return;
  }

  if (text === "/admin") {
    if (tgUserId === botRow.ownerId && tgUserId !== SUPER_ADMIN_ID) {
      const ownerUser = await ensureUser(botRow.id, tgUserId, botRow);
      await sendOwnerPanel(bot, chatId, botRow, asLang(ownerUser.language));
      return;
    }
    if (tgUserId !== SUPER_ADMIN_ID) {
      await bot.api.sendMessage(chatId, "⛔ عذراً، هذا الأمر مخصص لمالك المنصة فقط.");
      return;
    }
    await sendSuperAdminPanel(bot, chatId);
    return;
  }

  const user = await ensureUser(botRow.id, tgUserId, botRow);
  const lang = asLang(user.language);
  const pending = user.pendingAction as PendingAction | null;

  // Universal back button (either language's label). SUPER_ADMIN's "🔙"
  // (ADMIN_MENU) must return to THEIR panel, never the regular end-user
  // menu. A bot owner's "🔙" doesn't need special-casing any more — their
  // keyboard (ownerMainMenu) already includes the regular menu, so falling
  // through to the normal branch below is correct.
  if (isBack(lang, text)) {
    await setPending(user.id, null);
    if (tgUserId === SUPER_ADMIN_ID) {
      await sendSuperAdminPanel(bot, chatId);
      return;
    }
    const homeMenu = tgUserId === botRow.ownerId ? ownerMainMenu(lang) : mainMenu(lang);
    await bot.api.sendMessage(chatId, t(lang, "mainMenuTitle"), { reply_markup: homeMenu });
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
    await setPending(user.id, { mode: "withdraw_address" });
    await bot.api.sendMessage(chatId, t(lang, "withdrawAddressPrompt"), { reply_markup: amountEntryMenu(lang) });
    return;
  }
  if (pending?.mode === "withdraw_address") {
    const address = text.trim();
    if (address.length < 10) {
      await bot.api.sendMessage(chatId, t(lang, "withdrawAddressError"));
      return;
    }
    await setPending(user.id, { mode: "withdraw_amount", address });
    await bot.api.sendMessage(chatId, t(lang, "withdrawAmountPrompt", { min: MIN_WITHDRAWAL }), { reply_markup: amountEntryMenu(lang) });
    return;
  }
  if (pending?.mode === "withdraw_amount") {
    await consumeWithdrawAmount(bot, chatId, user, pending.address, text, lang);
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
    const [botsCount, usersCount, revenueAgg, pendingWithdrawalsAgg] = await Promise.all([
      prisma.bot.count(),
      prisma.user.count(),
      prisma.bot.aggregate({ _sum: { totalRevenue: true } }),
      prisma.transaction.aggregate({
        where: { type: { in: ["WITHDRAWAL", "OWNER_WITHDRAWAL"] }, status: { in: ["PENDING", "PENDING_AUDIT"] } },
        _sum: { amount: true },
      }),
    ]);
    await bot.api.sendMessage(
      chatId,
      `📊 إحصائيات المنصة:\nعدد البوتات: ${botsCount}\nعدد المستخدمين: ${usersCount}\nأرباح المنصة التراكمية: ${fmt(Number(revenueAgg._sum.totalRevenue || 0))}\n💼 المحفظة المركزية — طلبات سحب معلّقة: ${fmt(Number(pendingWithdrawalsAgg._sum.amount || 0))}`,
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
      `💼 رصيدك الجاهز للسحب: ${fmt(Number(fresh?.ownerBalance || 0))}\n⏳ رصيد قيد الحجز (48 ساعة): ${fmt(Number(fresh?.pendingBalance || 0))}\n\nأرسل عنوان محفظتك (USDT-TRC20 أو TON) لطلب السحب (الحد الأدنى $${MIN_OWNER_WITHDRAWAL}):`,
      { reply_markup: amountEntryMenu("ar") }
    );
    return;
  }
  if (pending?.mode === "owner_withdraw_address" && tgUserId === botRow.ownerId) {
    const address = text.trim();
    if (address.length < 10) {
      await bot.api.sendMessage(chatId, "أرسل عنوان محفظة صالح (TRC20 أو TON).");
      return;
    }
    await setPending(user.id, { mode: "owner_withdraw_amount", address });
    await bot.api.sendMessage(chatId, "أرسل المبلغ بالدولار الذي تريد سحبه:", { reply_markup: amountEntryMenu("ar") });
    return;
  }
  if (pending?.mode === "owner_withdraw_amount" && tgUserId === botRow.ownerId) {
    const amount = Number(text.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amount) || amount < MIN_OWNER_WITHDRAWAL) {
      await bot.api.sendMessage(chatId, `الحد الأدنى للسحب $${MIN_OWNER_WITHDRAWAL}. أرسل رقماً صحيحاً.`);
      return;
    }
    const fresh = await prisma.bot.findUnique({ where: { id: botRow.id } });
    const ownerBalance = Number(fresh?.ownerBalance || 0);
    if (amount > ownerBalance) {
      await bot.api.sendMessage(chatId, `رصيدك الحالي القابل للسحب ${fmt(ownerBalance)} فقط.`);
      return;
    }
    const isAudit = amount > AUDIT_THRESHOLD;
    await prisma.bot.update({ where: { id: botRow.id }, data: { ownerBalance: round2(ownerBalance - amount) } });
    const tx = await prisma.transaction.create({
      data: { userId: user.id, botId: botRow.id, amount: round2(amount), currency: "internal", type: "OWNER_WITHDRAWAL", status: isAudit ? "PENDING_AUDIT" : "PENDING" },
    });
    await setPending(user.id, null);
    await bot.api.sendMessage(
      chatId,
      `✅ تم إرسال طلب سحب ${fmt(amount)} إلى العنوان: ${pending.address}\nسيتم التحويل خلال 24-48 ساعة بعد المراجعة.`,
      { reply_markup: ownerMainMenu(lang) }
    );
    if (SUPER_ADMIN_ID) {
      const auditNote = isAudit ? "\n🔺 يتجاوز 20$ — يتطلب تدقيقاً." : "";
      await bot.api
        .sendMessage(
          Number(SUPER_ADMIN_ID),
          `طلب سحب أرباح منشئ بوت\nالبوت: ${botRow.id}\nالمالك: ${user.id}\nالمبلغ: ${fmt(amount)}\nالعنوان: ${pending.address}${auditNote}\n\nللموافقة أرسل: موافقة ${shortId(tx.id)}\nللرفض أرسل: رفض ${shortId(tx.id)}`
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
      { reply_markup: ownerMainMenu(lang) }
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
    await bot.api.sendMessage(chatId, `تم الإرسال: ${sent} نجح، ${failed} فشل.`, { reply_markup: ownerMainMenu(lang) });
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
    await bot.api.sendMessage(chatId, cancel ? "✅ تم إلغاء الاشتراك الإجباري." : `✅ تم تفعيل الاشتراك الإجباري في القناة @${channel}.`, { reply_markup: ownerMainMenu(lang) });
    return;
  }

  // --- Platform-picker (disambiguated by pendingAction.intent) ---
  if (pending?.mode === "platform_pick" && LABEL_TO_TYPE[text]) {
    const type = LABEL_TO_TYPE[text];
    if (pending.intent === "watch") {
      await startWatchCarousel(bot, chatId, tgUserId, type, lang, botRow.id, user.id);
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

  if (pending?.mode === "create_ad") {
    await consumeCreateAdStep(bot, chatId, user, pending, text, lang);
    return;
  }
  if (pending?.mode === "admin_broadcast" && tgUserId === SUPER_ADMIN_ID) {
    await runBroadcast(bot, chatId, text);
    await setPending(user.id, null);
    return;
  }

  // Unrecognized input falls back to whichever menu belongs to this
  // sender — SUPER_ADMIN never sees the regular end-user menu; a bot
  // owner's menu already includes it, so it's the same fallback message
  // with their merged keyboard.
  if (tgUserId === SUPER_ADMIN_ID) {
    await sendSuperAdminPanel(bot, chatId);
    return;
  }
  const fallbackMenu = tgUserId === botRow.ownerId ? ownerMainMenu(lang) : mainMenu(lang);
  await bot.api.sendMessage(chatId, t(lang, "chooseUnknown"), { reply_markup: fallbackMenu });
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

async function consumeWithdrawAmount(bot: TelegramBot, chatId: number, user: any, address: string, text: string, lang: Lang) {
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
  const isAudit = amount > AUDIT_THRESHOLD;
  await prisma.user.update({ where: { id: user.id }, data: { balance: round2(balance - amount) } });
  const tx = await prisma.transaction.create({
    data: { userId: user.id, amount: round2(amount), currency: "internal", type: "WITHDRAWAL", status: isAudit ? "PENDING_AUDIT" : "PENDING" },
  });
  await setPending(user.id, null);
  await bot.api.sendMessage(chatId, t(lang, "withdrawSent", { amount: fmt(amount) }), { reply_markup: mainMenu(lang) });

  if (SUPER_ADMIN_ID) {
    const auditNote = isAudit ? "\n🔺 يتجاوز 20$ — يتطلب تدقيقاً." : "";
    await bot.api
      .sendMessage(
        Number(SUPER_ADMIN_ID),
        `طلب سحب جديد\nمستخدم: ${user.id}\nالمبلغ: ${fmt(amount)}\nالعنوان: ${address}${auditNote}\n\nللموافقة أرسل: موافقة ${shortId(tx.id)}\nللرفض أرسل: رفض ${shortId(tx.id)}`
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

// Pool = this bot's own TARGETED campaigns + the platform-wide GLOBAL pool
// (forced platform ads are created with scope "GLOBAL" too, see
// createGlobalAd, so they fall into the same OR branch automatically).
// This bot's own campaigns rank first, then the global pool, highest-paying
// first within each group; already-completed-by-this-user ads are excluded
// via the same synthetic txHash used for double-claim protection
// (`task_<adId>_<userId>`) — there's no separate "completed" relation in
// this schema, so it's derived from Transaction directly.
async function buildAdQueue(tgUserId: string, type: AdTypeStr, currentBotId: string): Promise<string[]> {
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

  const doneTx = await prisma.transaction.findMany({
    where: { userId: tgUserId, type: "TASK_REWARD", txHash: { not: null } },
    select: { txHash: true },
  });
  const doneAdIds = new Set(
    doneTx
      .map((tx) => tx.txHash?.match(/^task_(.+)_[^_]+$/)?.[1])
      .filter((id): id is string => !!id)
  );

  return ads
    .filter((a) => !doneAdIds.has(a.id))
    .filter((a) => a.cpc === 0 || Number(a.remaining) >= Number(a.cpc))
    .sort((a, b) => {
      const aOwn = a.botId === currentBotId ? 0 : 1;
      const bOwn = b.botId === currentBotId ? 0 : 1;
      if (aOwn !== bOwn) return aOwn - bOwn;
      return Number(b.cpc) - Number(a.cpc);
    })
    .slice(0, 10)
    .map((a) => a.id);
}

// Single-ad InlineKeyboard card for the carousel. Non-Telegram ad types get
// their action button wrapped in a per-user /watch/<token> countdown page
// (AdClick row, minted/reset every time this card is shown) instead of a
// direct link — the anti-cheat time-tracking gate from the owner's spec.
// Telegram ads open t.me directly since getChatMember is a hard, instant,
// unspoofable check that doesn't need a timer.
async function buildCarouselCard(ad: any, lang: Lang, tgUserId: string, currentBotId: string): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const type = ad.type as AdTypeStr;
  const isForced = Number(ad.cpc) === 0;
  const kb = new InlineKeyboard();

  let actionUrl: string;
  if (type === "TELEGRAM") {
    actionUrl = `https://t.me/${String(ad.content).replace(/^@/, "")}`;
  } else {
    const click = await prisma.adClick.upsert({
      where: { adId_userId: { adId: ad.id, userId: tgUserId } },
      update: { issuedAt: new Date(), verified: false, botId: currentBotId },
      create: { adId: ad.id, userId: tgUserId, botId: currentBotId },
    });
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app").replace(/\/$/, "");
    actionUrl = `${site}/watch/${click.id}`;
  }
  kb.url(CAROUSEL_ACTION_LABEL[type][lang], actionUrl).row();
  if (!isForced) kb.text(t(lang, "carouselVerify"), `wcv|${shortId(ad.id)}`).row();
  kb.text(t(lang, "carouselNext"), `wcn|${shortId(ad.id)}`).text(t(lang, "carouselReport"), `wcr|${shortId(ad.id)}`).row();
  kb.text(t(lang, "carouselExit"), "wcx");

  const lines = [
    isForced ? t(lang, "watchForcedLabel") : t(lang, "carouselAdTitle", { platform: TYPE_LABEL[type][lang] }),
    !isForced ? t(lang, "carouselReward", { reward: fmt(Number(ad.workerCut)) }) : null,
  ].filter((l): l is string => !!l);
  return { text: lines.join("\n"), keyboard: kb };
}

async function startWatchCarousel(bot: TelegramBot, chatId: number, tgUserId: string, type: AdTypeStr, lang: Lang, currentBotId: string, userId: string) {
  const queue = await buildAdQueue(tgUserId, type, currentBotId);
  if (queue.length === 0) {
    await setPending(userId, null);
    await bot.api.sendMessage(chatId, t(lang, "watchNoAds"), { reply_markup: mainMenu(lang) });
    return;
  }
  const ad = await prisma.ad.findUnique({ where: { id: queue[0] } });
  if (!ad) {
    await setPending(userId, null);
    await bot.api.sendMessage(chatId, t(lang, "watchNoAds"), { reply_markup: mainMenu(lang) });
    return;
  }
  const { text, keyboard } = await buildCarouselCard(ad, lang, tgUserId, currentBotId);
  await bot.api.sendMessage(chatId, text, { reply_markup: keyboard });
  await setPending(userId, { mode: "watch_carousel", type, queue, index: 0 });
}

type PayoutResult =
  | { ok: true; workerCut: number; newBalance: number }
  | { ok: false; reason: "gone" | "own" | "not_done" | "already_claimed" | "flagged" };

// Atomic payout core shared by the carousel's verify handler. Verification
// (Telegram membership / link-timer token) must already have passed before
// this is called — it only re-checks the ad is still claimable and pays out.
//
// Split of ad.cpc, in order: 50% workerCut to the completing user (full,
// unaffected by referrals) — 20% creatorCut into the completing bot's 48h
// pendingBalance hold (CREATOR_EARNING_PENDING, matured by the
// release-pending-earnings cron) — 30% ownerCut to the platform, out of
// which: a 5%-of-workerCut referral commission goes to whoever referred
// the completing user (if any), then a further 5%-of-what's-left B2B
// commission goes to whoever referred the completing bot's own activation
// (if any); whatever remains is the platform's actual PLATFORM_PROFIT.
async function payoutTask(tgUserId: string, adId: string, currentBotId: string): Promise<PayoutResult> {
  const ad = await prisma.ad.findUnique({ where: { id: adId } });
  if (!ad || ad.status !== "ACTIVE" || Number(ad.remaining) < Number(ad.cpc)) return { ok: false, reason: "gone" };
  if (ad.userId === tgUserId) return { ok: false, reason: "own" };

  // Ensure the FK targets of the atomic batch below exist first — upserting
  // inside prisma.$transaction([...]) isn't necessary for these two (they're
  // idempotent no-ops when the row already exists), only the actual balance
  // mutations need to be atomic together.
  const completingUser = await prisma.user.upsert({ where: { id: tgUserId }, update: {}, create: { id: tgUserId, botId: ad.botId, role: "USER" } });
  if (completingUser.multiAccountFlag) return { ok: false, reason: "flagged" };
  if (SUPER_ADMIN_ID) {
    await prisma.user.upsert({ where: { id: SUPER_ADMIN_ID }, update: {}, create: { id: SUPER_ADMIN_ID, botId: ad.botId, role: "SUPER_ADMIN" } });
  }

  const currentBot = await prisma.bot.findUnique({ where: { id: currentBotId } });
  if (!currentBot) return { ok: false, reason: "gone" };

  const newRemaining = round2(Number(ad.remaining) - Number(ad.cpc));
  const workerCut = Number(ad.workerCut);
  const creatorCut = Number(ad.creatorCut);
  const ownerCut = Number(ad.ownerCut);

  let referrerId: string | null = null;
  if (completingUser.referredBy && completingUser.referredBy !== tgUserId) {
    const referrer = await prisma.user.findUnique({ where: { id: completingUser.referredBy } });
    if (referrer) referrerId = referrer.id;
  }
  const referralCut = referrerId ? round2(workerCut * 0.05) : 0;
  const platformAfterUserReferral = round2(ownerCut - referralCut);

  const b2bOwnerId = currentBot.referredByOwnerId && currentBot.referredByOwnerId !== currentBot.ownerId ? currentBot.referredByOwnerId : null;
  const b2bCut = b2bOwnerId ? round2(platformAfterUserReferral * 0.05) : 0;
  const platformFinal = round2(platformAfterUserReferral - b2bCut);

  // Atomic — the dedup guard (unique txHash) is the first operation, so a
  // double-claim rolls back every other write in this batch too, not just
  // the log row. Without $transaction here, a crash between steps could
  // leave the ad's budget decremented with no one actually paid, or the
  // reverse — a real risk once real money is on the line.
  const ops: Prisma.PrismaPromise<any>[] = [
    prisma.transaction.create({
      data: { userId: tgUserId, botId: currentBotId, amount: workerCut, currency: "internal", type: "TASK_REWARD", status: "COMPLETED", txHash: `task_${adId}_${tgUserId}` },
    }),
    prisma.ad.update({ where: { id: ad.id }, data: { remaining: newRemaining, status: newRemaining < Number(ad.cpc) ? "EXPIRED" : ad.status } }),
    prisma.user.update({ where: { id: tgUserId }, data: { balance: { increment: workerCut } } }),
    // 20% creator cut goes into the completing bot's 48h hold
    // (pendingBalance), not the withdrawable ownerBalance directly —
    // matured later by the release-pending-earnings cron.
    prisma.bot.update({ where: { id: currentBotId }, data: { pendingBalance: { increment: creatorCut }, totalRevenue: { increment: ownerCut } } }),
    prisma.transaction.create({
      data: { userId: currentBot.ownerId, botId: currentBotId, amount: creatorCut, currency: "internal", type: "CREATOR_EARNING_PENDING", status: "PENDING" },
    }),
  ];
  if (referrerId) {
    ops.push(
      prisma.user.update({ where: { id: referrerId }, data: { balance: { increment: referralCut } } }),
      prisma.transaction.create({ data: { userId: referrerId, botId: currentBotId, amount: referralCut, currency: "internal", type: "REFERRAL_COMMISSION", status: "COMPLETED" } })
    );
  }
  if (b2bOwnerId) {
    ops.push(
      prisma.user.upsert({
        where: { id: b2bOwnerId },
        update: { balance: { increment: b2bCut } },
        create: { id: b2bOwnerId, botId: currentBotId, role: "BOT_OWNER", balance: b2bCut },
      }),
      prisma.transaction.create({ data: { userId: b2bOwnerId, botId: currentBotId, amount: b2bCut, currency: "internal", type: "REFERRAL_B2B_COMMISSION", status: "COMPLETED" } })
    );
  }
  if (SUPER_ADMIN_ID) {
    ops.push(
      prisma.transaction.create({ data: { userId: SUPER_ADMIN_ID, botId: currentBotId, amount: platformFinal, currency: "internal", type: "PLATFORM_PROFIT", status: "COMPLETED" } })
    );
  }

  let results;
  try {
    results = await prisma.$transaction(ops);
  } catch {
    return { ok: false, reason: "already_claimed" };
  }

  const updatedWorker = results[2] as { balance: number };
  return { ok: true, workerCut, newBalance: Number(updatedWorker.balance) };
}

async function isAdVerifiedByUser(bot: TelegramBot, ad: any, tgUserId: string): Promise<boolean> {
  if (ad.type === "TELEGRAM") {
    return isChannelMember(bot, ad.content, tgUserId);
  }
  const click = await prisma.adClick.findUnique({ where: { adId_userId: { adId: ad.id, userId: tgUserId } } });
  return !!click?.verified;
}

async function handleCarouselCallback(bot: TelegramBot, botRow: BotRow, cq: any) {
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const tgUserId = String(cq.from.id);
  const data = String(cq.data || "");
  if (!chatId || !messageId) {
    await bot.api.answerCallbackQuery(cq.id).catch(() => null);
    return;
  }
  const user = await ensureUser(botRow.id, tgUserId, botRow);
  const lang = asLang(user.language);
  const pending = user.pendingAction as PendingAction | null;

  if (data === "wcx") {
    await setPending(user.id, null);
    await bot.api.answerCallbackQuery(cq.id).catch(() => null);
    await bot.api.editMessageText(chatId, messageId, t(lang, "carouselCancelled")).catch(() => null);
    await bot.api.sendMessage(chatId, t(lang, "mainMenuTitle"), { reply_markup: mainMenu(lang) });
    return;
  }

  if (pending?.mode !== "watch_carousel") {
    await bot.api.answerCallbackQuery(cq.id, { text: t(lang, "taskGone"), show_alert: true }).catch(() => null);
    return;
  }

  const [action, shortAdId] = data.split("|");
  const currentAdId = pending.queue[pending.index];
  if (!currentAdId || shortId(currentAdId) !== shortAdId) {
    await bot.api.answerCallbackQuery(cq.id, { text: t(lang, "taskGone"), show_alert: true }).catch(() => null);
    return;
  }

  if (action === "wcv") {
    if (!user.phoneVerified) {
      await bot.api.answerCallbackQuery(cq.id, { text: t(lang, "phoneRequiredAlert"), show_alert: true }).catch(() => null);
      await bot.api.sendMessage(chatId, t(lang, "phoneVerifyPrompt"), { reply_markup: phoneRequestMenu(lang) });
      return;
    }
    if (user.multiAccountFlag) {
      await bot.api.answerCallbackQuery(cq.id, { text: t(lang, "accountFlaggedAlert"), show_alert: true }).catch(() => null);
      return;
    }
    const ad = await prisma.ad.findUnique({ where: { id: currentAdId } });
    if (!ad || ad.status !== "ACTIVE") {
      await bot.api.answerCallbackQuery(cq.id, { text: t(lang, "taskGone"), show_alert: true }).catch(() => null);
      return;
    }
    if (ad.userId === tgUserId) {
      await bot.api.answerCallbackQuery(cq.id, { text: t(lang, "taskOwnCampaign"), show_alert: true }).catch(() => null);
      return;
    }
    const verified = await isAdVerifiedByUser(bot, ad, tgUserId);
    if (!verified) {
      await bot.api.answerCallbackQuery(cq.id, { text: t(lang, "carouselNotDoneAlert"), show_alert: true }).catch(() => null);
      return;
    }
    const result = await payoutTask(tgUserId, currentAdId, botRow.id);
    if (!result.ok) {
      const alertText =
        result.reason === "already_claimed"
          ? t(lang, "taskAlreadyClaimed")
          : result.reason === "own"
            ? t(lang, "taskOwnCampaign")
            : result.reason === "flagged"
              ? t(lang, "accountFlaggedAlert")
              : t(lang, "taskGone");
      await bot.api.answerCallbackQuery(cq.id, { text: alertText, show_alert: true }).catch(() => null);
      return;
    }
    await bot.api.answerCallbackQuery(cq.id).catch(() => null);
    await bot.api.editMessageText(chatId, messageId, t(lang, "carouselSuccess", { amount: fmt(result.workerCut), balance: fmt(result.newBalance) })).catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await advanceCarousel(bot, chatId, messageId, user.id, pending, lang, botRow.id, tgUserId);
    return;
  }

  if (action === "wcn") {
    await bot.api.answerCallbackQuery(cq.id).catch(() => null);
    await advanceCarousel(bot, chatId, messageId, user.id, pending, lang, botRow.id, tgUserId);
    return;
  }

  if (action === "wcr") {
    const already = await prisma.adReport.findUnique({ where: { adId_userId: { adId: currentAdId, userId: tgUserId } } });
    if (already) {
      await bot.api.answerCallbackQuery(cq.id, { text: t(lang, "reportAlready"), show_alert: true }).catch(() => null);
      return;
    }
    await prisma.adReport.create({ data: { adId: currentAdId, userId: tgUserId } });
    const updatedAd = await prisma.ad.update({ where: { id: currentAdId }, data: { reportCount: { increment: 1 } } });
    if (updatedAd.reportCount >= 5 && updatedAd.status === "ACTIVE") {
      await prisma.ad.update({ where: { id: currentAdId }, data: { status: "FLAGGED" } });
      if (SUPER_ADMIN_ID) {
        await bot.api.sendMessage(Number(SUPER_ADMIN_ID), `🚩 تم تجميد إعلان (${shortId(currentAdId)}) تلقائياً بعد 5 بلاغات مستخدمين.`).catch(() => null);
      }
    }
    await bot.api.answerCallbackQuery(cq.id, { text: t(lang, "reportReceived") }).catch(() => null);
    return;
  }

  await bot.api.answerCallbackQuery(cq.id).catch(() => null);
}

async function advanceCarousel(
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  userId: string,
  pending: Extract<PendingAction, { mode: "watch_carousel" }>,
  lang: Lang,
  currentBotId: string,
  tgUserId: string
) {
  const nextIndex = pending.index + 1;
  if (nextIndex >= pending.queue.length) {
    await setPending(userId, null);
    await bot.api.editMessageText(chatId, messageId, t(lang, "carouselDone")).catch(() => null);
    await bot.api.sendMessage(chatId, t(lang, "mainMenuTitle"), { reply_markup: mainMenu(lang) });
    return;
  }
  const nextAdId = pending.queue[nextIndex];
  const ad = await prisma.ad.findUnique({ where: { id: nextAdId } });
  if (!ad || ad.status !== "ACTIVE" || (Number(ad.cpc) > 0 && Number(ad.remaining) < Number(ad.cpc))) {
    await advanceCarousel(bot, chatId, messageId, userId, { ...pending, index: nextIndex }, lang, currentBotId, tgUserId);
    return;
  }
  const { text, keyboard } = await buildCarouselCard(ad, lang, tgUserId, currentBotId);
  await setPending(userId, { ...pending, index: nextIndex });
  await bot.api.editMessageText(chatId, messageId, text, { reply_markup: keyboard }).catch(() => null);
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

  // Auto-moderation: scanned once at creation, no manual review step when
  // clean (stays ACTIVE, the schema default). A violation gets REJECTED
  // and never charges the advertiser.
  const scanText = [collected.target, collected.description].filter(Boolean).join(" ");
  let rejected = containsBannedWords(scanText);
  if (!rejected && type === "LINK" && collected.target) {
    const url = /^https?:\/\//i.test(collected.target) ? collected.target : `https://${collected.target}`;
    rejected = await isLinkUnsafe(url);
  }

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
      status: rejected ? "REJECTED" : "ACTIVE",
      scope,
      targetBotId: scope === "TARGETED" ? fresh!.botId : null,
    },
  });
  await setPending(user.id, null);
  if (rejected) {
    await bot.api.sendMessage(chatId, t(lang, "adAutoRejected"), { reply_markup: mainMenu(lang) });
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { balance: round2(balance - budget) } });
  await prisma.transaction.create({ data: { userId: user.id, amount: budget, currency: "internal", type: "AD_PAYMENT", status: "COMPLETED" } });
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
  const candidates = await prisma.transaction.findMany({ where: { status: { in: ["PENDING", "PENDING_AUDIT"] }, type: { in: ["WITHDRAWAL", "OWNER_WITHDRAWAL"] } }, take: 200 });
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
