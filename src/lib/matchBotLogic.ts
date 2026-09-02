import { Bot as TelegramBot, Keyboard, InlineKeyboard } from "grammy";
import { prisma } from "@/lib/prisma";
import type { Bot as BotRow, MatchProfile, PartnerPreference } from "@prisma/client";

/**
 * MARRIAGE_BOT template (owner spec, 2026-09-02) — a fully independent
 * matchmaking/marriage bot, deliberately separate from AD_BOT's data model
 * and business logic (see prisma/schema.prisma's MatchUser/MatchProfile/...
 * block for the full reasoning). Arabic-only — no bilingual requirement was
 * given for this bot, unlike AD_BOT.
 *
 * Two UI conventions, both deliberate:
 * - Reply keyboards (Keyboard) for the main menu and every step wizard —
 *   consistent with the rest of the platform.
 * - InlineKeyboard ONLY on the search-result card and during an active
 *   random chat's control row — same precedent as AD_BOT's ad carousel:
 *   per-card actions (like/report/block/next) are naturally suited to
 *   buttons attached to one specific message, not the persistent bottom
 *   keyboard.
 */

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || "";
const RANDOM_CHAT_WINDOW_SECONDS = 60;
const SKIP_COOLDOWN_HOURS = 24;
const ONLINE_THRESHOLD_MINUTES = 5;

function shortId(id: string): string {
  return id.slice(-6);
}

type Gender = "MALE" | "FEMALE";
type ProfileStep = "gender" | "name" | "age" | "country" | "job" | "education" | "attributes" | "contactMethod" | "contactValue" | "photo";
type PrefStep = "country" | "ageMin" | "ageMax" | "job" | "education" | "attributes";
type ProfileDraft = {
  gender?: Gender;
  name?: string;
  age?: number;
  country?: string;
  job?: string | null;
  education?: string | null;
  attributes?: string | null;
  contactMethod?: "TELEGRAM" | "WHATSAPP";
  contactValue?: string;
};
type PrefDraft = {
  country?: string;
  ageMin?: number | null;
  ageMax?: number | null;
  job?: string | null;
  education?: string | null;
  attributes?: string | null;
};

type PendingAction =
  | { mode: "profile_wizard"; step: ProfileStep; data: ProfileDraft }
  | { mode: "pref_wizard"; step: PrefStep; data: PrefDraft }
  | { mode: "search_browsing"; queue: string[]; index: number }
  | { mode: "random_waiting" }
  | { mode: "random_chatting"; sessionId: string; partnerId: string }
  | { mode: "admin_reject_reason"; profileId: string }
  | { mode: "confirm_delete_profile" }
  | { mode: "admin_broadcast" }
  | { mode: "admin_lookup" }
  | { mode: "admin_unban" }
  | { mode: "contact_admin_compose" }
  | { mode: "admin_reply"; targetUserId: string; messageId: string };

const SKIP_LABEL = "⏭ غير محدد / لا يهم";

function backLabel() {
  return "🔙 القائمة الرئيسية";
}
function mainMenu(): Keyboard {
  return new Keyboard()
    .text("👤 ملفي الشخصي").text("💍 مواصفات الشريك").row()
    .text("🔍 البحث عن شريك").text("🔀 مراسلة عشوائية").row()
    .text("💌 من أعجب بي").text("ℹ️ معلومات")
    .resized();
}
function infoMenu(): Keyboard {
  return new Keyboard()
    .text("📩 مراسلة الأدمن").text("🔗 دعوة رابط البوت").row()
    .text(backLabel())
    .resized();
}
function adminMenu(): Keyboard {
  return new Keyboard()
    .text("📊 الإحصائيات").text("📋 الملفات المعلقة").row()
    .text("🚩 بلاغات المطابقة").text("🚩 بلاغات الدردشة العشوائية").row()
    .text("📢 بث جماعي").text("🔎 بحث عن مستخدم").row()
    .text("🔓 رفع حظر/كتم").text("📥 الرسائل الواردة")
    .resized();
}
const ADMIN_COMMANDS = new Set([
  "/start",
  "📊 الإحصائيات",
  "📋 الملفات المعلقة",
  "🚩 بلاغات المطابقة",
  "🚩 بلاغات الدردشة العشوائية",
  "📢 بث جماعي",
  "🔎 بحث عن مستخدم",
  "🔓 رفع حظر/كتم",
  "📥 الرسائل الواردة",
]);
const DELETE_CONFIRM_LABEL = "✅ نعم، احذف نهائياً";
function confirmDeleteMenu(): Keyboard {
  return new Keyboard().text(DELETE_CONFIRM_LABEL).row().text(backLabel()).resized();
}
const CONTACT_ADMIN_CONFIRM_LABEL = "✅ متابعة ومراسلة الأدمن";
const CONTACT_ADMIN_WARNING =
  "⚠️ تنبيه هام قبل المتابعة\n\n" +
  "هذه القناة مخصصة حصرياً للمشاكل الجدية المتعلقة بالبوت (مشكلة تقنية فعلية، إساءة خطيرة من مستخدم آخر، أو استفسار إداري حقيقي).\n\n" +
  "🚫 أي استخدام عبثي، رسائل مزعجة، أو تكرار غير مبرر لهذه الميزة سيؤدي إلى حظرك فوراً ونهائياً من هذا البوت دون أي إنذار إضافي.\n\n" +
  "إن كنت متأكداً أن لديك سبباً جدياً فعلاً، اضغط الزر أدناه ثم أرسل رسالتك.";
function contactAdminConfirmMenu(): Keyboard {
  return new Keyboard().text(CONTACT_ADMIN_CONFIRM_LABEL).row().text(backLabel()).resized();
}
function skipMenu(): Keyboard {
  return new Keyboard().text(SKIP_LABEL).row().text(backLabel()).resized();
}
function plainBackMenu(): Keyboard {
  return new Keyboard().text(backLabel()).resized();
}
function genderMenu(): Keyboard {
  return new Keyboard().text("👨 ذكر").text("👩 أنثى").row().text(backLabel()).resized();
}
function contactMethodMenu(): Keyboard {
  return new Keyboard().text("✈️ تلجرام").text("💬 واتساب").row().text(backLabel()).resized();
}
function photoStepMenu(): Keyboard {
  return new Keyboard().text(SKIP_LABEL).row().text(backLabel()).resized();
}
function randomChatMenu(): Keyboard {
  return new Keyboard().text("⏹ إنهاء المحادثة").text("⛔ حظر").row().text("🚩 إبلاغ").resized();
}
function isBack(text: string): boolean {
  return text === backLabel();
}
function isSkip(text: string): boolean {
  return text === SKIP_LABEL;
}

async function setPending(userId: string, action: PendingAction | null) {
  await prisma.matchUser.update({ where: { id: userId }, data: { pendingAction: action as any } });
}

async function ensureMatchUser(botId: string, tgUserId: string) {
  const existing = await prisma.matchUser.findUnique({ where: { id: tgUserId } });
  if (existing) return existing;
  return prisma.matchUser.create({ data: { id: tgUserId, botId } });
}

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "قبل لحظات";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `قبل ${days} يوم`;
}
function presenceLabel(lastActiveAt: Date): string {
  const minutes = (Date.now() - lastActiveAt.getTime()) / 60000;
  return minutes <= ONLINE_THRESHOLD_MINUTES ? "🟢 متصل الآن" : `⚪ آخر ظهور: ${relativeTime(lastActiveAt)}`;
}

async function isMutuallyBlocked(aId: string, bId: string): Promise<boolean> {
  const block = await prisma.matchBlock.findFirst({
    where: { OR: [{ blockerId: aId, blockedId: bId }, { blockerId: bId, blockedId: aId }] },
  });
  return !!block;
}

// ---------------------------------------------------------------------
// Profile wizard
// ---------------------------------------------------------------------
const PROFILE_STEP_ORDER: ProfileStep[] = ["gender", "name", "age", "country", "job", "education", "attributes", "contactMethod", "contactValue", "photo"];
function nextProfileStep(step: ProfileStep): ProfileStep | null {
  const i = PROFILE_STEP_ORDER.indexOf(step);
  return i >= 0 && i + 1 < PROFILE_STEP_ORDER.length ? PROFILE_STEP_ORDER[i + 1] : null;
}
async function askProfileStep(bot: TelegramBot, chatId: number, step: ProfileStep) {
  switch (step) {
    case "gender":
      await bot.api.sendMessage(chatId, "👤 إنشاء ملفك الشخصي\n\nما هو جنسك؟", { reply_markup: genderMenu() });
      break;
    case "name":
      await bot.api.sendMessage(chatId, "أرسل اسمك:", { reply_markup: plainBackMenu() });
      break;
    case "age":
      await bot.api.sendMessage(chatId, "أرسل عمرك (رقماً):", { reply_markup: plainBackMenu() });
      break;
    case "country":
      await bot.api.sendMessage(chatId, "أرسل دولتك:", { reply_markup: plainBackMenu() });
      break;
    case "job":
      await bot.api.sendMessage(chatId, "أرسل عملك:", { reply_markup: skipMenu() });
      break;
    case "education":
      await bot.api.sendMessage(chatId, "أرسل مستواك التعليمي:", { reply_markup: skipMenu() });
      break;
    case "attributes":
      await bot.api.sendMessage(chatId, "أرسل وصفاً موجزاً لمواصفاتك (الطول، اللون، إلخ):", { reply_markup: skipMenu() });
      break;
    case "contactMethod":
      await bot.api.sendMessage(chatId, "ما هي وسيلة التواصل التي تفضلها لتلقي الرسائل؟", { reply_markup: contactMethodMenu() });
      break;
    case "contactValue":
      await bot.api.sendMessage(chatId, "أرسل معرّفك في تلجرام (@username) أو رقم هاتفك على واتساب:", { reply_markup: plainBackMenu() });
      break;
    case "photo":
      await bot.api.sendMessage(chatId, "أرسل صورة شخصية لملفك (اختياري):", { reply_markup: photoStepMenu() });
      break;
  }
}

async function startProfileWizard(bot: TelegramBot, chatId: number, userId: string) {
  await setPending(userId, { mode: "profile_wizard", step: "gender", data: {} });
  await askProfileStep(bot, chatId, "gender");
}

async function saveProfile(bot: TelegramBot, chatId: number, userId: string, data: ProfileDraft, photoFileId?: string) {
  const shared = {
    gender: data.gender!,
    name: data.name!,
    age: data.age!,
    country: data.country!,
    job: data.job ?? null,
    education: data.education ?? null,
    attributes: data.attributes ?? null,
    contactMethod: data.contactMethod!,
    contactValue: data.contactValue!,
    status: "PENDING",
  };
  await prisma.matchProfile.upsert({
    where: { userId },
    update: { ...shared, ...(photoFileId ? { photoFileId } : {}) },
    create: { userId, ...shared, photoFileId: photoFileId ?? null },
  });
  await setPending(userId, null);
  await bot.api.sendMessage(
    chatId,
    "✅ تم حفظ ملفك الشخصي، وهو الآن قيد المراجعة من إدارة البوت. سيصلك إشعار فور اعتماده.",
    { reply_markup: mainMenu() }
  );
  if (SUPER_ADMIN_ID) {
    const profile = await prisma.matchProfile.findUnique({ where: { userId } });
    if (profile) await notifyAdminNewProfile(bot, profile);
  }
}

async function notifyAdminNewProfile(bot: TelegramBot, profile: MatchProfile) {
  // Buttons carry the full userId in callback_data — see handleAdminCallback.
  // The text commands (موافقة ملف/رفض ملف <رمز>) still work too, as a
  // fallback for whenever a message with buttons has scrolled out of view.
  const text =
    (profile.status === "PENDING" ? `👤 ملف بانتظار المراجعة` : `👤 ملف`) + ` #${shortId(profile.userId)}\n\n` +
    `الاسم: ${profile.name}\nالجنس: ${profile.gender === "MALE" ? "ذكر" : "أنثى"}\nالعمر: ${profile.age}\nالدولة: ${profile.country}\n` +
    `العمل: ${profile.job || "غير محدد"}\nالتعليم: ${profile.education || "غير محدد"}\nالمواصفات: ${profile.attributes || "غير محدد"}\n` +
    `التواصل: ${profile.contactMethod === "TELEGRAM" ? "تلجرام" : "واتساب"} — ${profile.contactValue}`;
  const kb = new InlineKeyboard().text("✅ قبول", `madmin_approve|${profile.userId}`).text("❌ رفض", `madmin_reject|${profile.userId}`);
  try {
    if (profile.photoFileId) {
      await bot.api.sendPhoto(Number(SUPER_ADMIN_ID), profile.photoFileId, { caption: text, reply_markup: kb });
    } else {
      await bot.api.sendMessage(Number(SUPER_ADMIN_ID), text, { reply_markup: kb });
    }
  } catch {
    // admin unreachable — not fatal, they can still review later once they message the bot
  }
}

async function consumeProfileStep(bot: TelegramBot, chatId: number, userId: string, pending: Extract<PendingAction, { mode: "profile_wizard" }>, text: string) {
  const { step, data } = pending;
  if (step === "gender") {
    if (text !== "👨 ذكر" && text !== "👩 أنثى") {
      await bot.api.sendMessage(chatId, "اختر من القائمة.", { reply_markup: genderMenu() });
      return;
    }
    data.gender = text === "👨 ذكر" ? "MALE" : "FEMALE";
  } else if (step === "name") {
    if (!text) return;
    data.name = text;
  } else if (step === "age") {
    const age = Number(text.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(age) || age < 18 || age > 100) {
      await bot.api.sendMessage(chatId, "أرسل عمراً صحيحاً (18 فأكثر).");
      return;
    }
    data.age = age;
  } else if (step === "country") {
    if (!text) return;
    data.country = text;
  } else if (step === "job") {
    data.job = isSkip(text) ? null : text;
  } else if (step === "education") {
    data.education = isSkip(text) ? null : text;
  } else if (step === "attributes") {
    data.attributes = isSkip(text) ? null : text;
  } else if (step === "contactMethod") {
    if (text !== "✈️ تلجرام" && text !== "💬 واتساب") {
      await bot.api.sendMessage(chatId, "اختر من القائمة.", { reply_markup: contactMethodMenu() });
      return;
    }
    data.contactMethod = text === "✈️ تلجرام" ? "TELEGRAM" : "WHATSAPP";
  } else if (step === "contactValue") {
    if (!text) return;
    data.contactValue = data.contactMethod === "WHATSAPP" ? text.replace(/[^0-9+]/g, "") : text.replace(/^@/, "");
  } else if (step === "photo") {
    // An actual photo attachment is caught earlier in the main dispatcher
    // before this function ever runs — any text reaching here (the skip
    // button, or anything else) means "no photo", handled by the
    // fallthrough to saveProfile below since "photo" is the last step.
  }

  const next = nextProfileStep(step);
  if (!next) {
    await saveProfile(bot, chatId, userId, data);
    return;
  }
  await setPending(userId, { mode: "profile_wizard", step: next, data });
  await askProfileStep(bot, chatId, next);
}

// ---------------------------------------------------------------------
// Partner-preference wizard
// ---------------------------------------------------------------------
const PREF_STEP_ORDER: PrefStep[] = ["country", "ageMin", "ageMax", "job", "education", "attributes"];
function nextPrefStep(step: PrefStep): PrefStep | null {
  const i = PREF_STEP_ORDER.indexOf(step);
  return i >= 0 && i + 1 < PREF_STEP_ORDER.length ? PREF_STEP_ORDER[i + 1] : null;
}
async function askPrefStep(bot: TelegramBot, chatId: number, step: PrefStep, gender: Gender | undefined) {
  const you = gender === "FEMALE" ? "أنتِ" : "أنت";
  switch (step) {
    case "country":
      await bot.api.sendMessage(chatId, `💍 مواصفات الشريك الذي تبحث عنه\n\nما الدولة التي يفضّل ${you} أن يكون منها الشريك؟`, { reply_markup: plainBackMenu() });
      break;
    case "ageMin":
      await bot.api.sendMessage(chatId, "الحد الأدنى للعمر المطلوب:", { reply_markup: skipMenu() });
      break;
    case "ageMax":
      await bot.api.sendMessage(chatId, "الحد الأقصى للعمر المطلوب:", { reply_markup: skipMenu() });
      break;
    case "job":
      await bot.api.sendMessage(chatId, `ما العمل الذي ${you === "أنتِ" ? "تفضّلينه" : "تفضّله"} في الشريك؟`, { reply_markup: skipMenu() });
      break;
    case "education":
      await bot.api.sendMessage(chatId, "المستوى التعليمي المطلوب:", { reply_markup: skipMenu() });
      break;
    case "attributes":
      await bot.api.sendMessage(chatId, "المواصفات الأخرى المطلوبة (الطول، اللون، إلخ):", { reply_markup: skipMenu() });
      break;
  }
}
async function startPrefWizard(bot: TelegramBot, chatId: number, userId: string, gender: Gender | undefined) {
  await setPending(userId, { mode: "pref_wizard", step: "country", data: {} });
  await askPrefStep(bot, chatId, "country", gender);
}
async function savePref(bot: TelegramBot, chatId: number, userId: string, data: PrefDraft) {
  await prisma.partnerPreference.upsert({
    where: { userId },
    update: { country: data.country!, ageMin: data.ageMin ?? null, ageMax: data.ageMax ?? null, job: data.job ?? null, education: data.education ?? null, attributes: data.attributes ?? null },
    create: { userId, country: data.country!, ageMin: data.ageMin ?? null, ageMax: data.ageMax ?? null, job: data.job ?? null, education: data.education ?? null, attributes: data.attributes ?? null },
  });
  await setPending(userId, null);
  await bot.api.sendMessage(chatId, "✅ تم حفظ مواصفات الشريك. يمكنك الآن الضغط على «🔍 البحث عن شريك».", { reply_markup: mainMenu() });
}
async function consumePrefStep(bot: TelegramBot, chatId: number, userId: string, pending: Extract<PendingAction, { mode: "pref_wizard" }>, text: string, gender: Gender | undefined) {
  const { step, data } = pending;
  if (step === "country") {
    if (!text) return;
    data.country = text;
  } else if (step === "ageMin") {
    data.ageMin = isSkip(text) ? null : Number(text.replace(/[^0-9]/g, "")) || null;
  } else if (step === "ageMax") {
    data.ageMax = isSkip(text) ? null : Number(text.replace(/[^0-9]/g, "")) || null;
  } else if (step === "job") {
    data.job = isSkip(text) ? null : text;
  } else if (step === "education") {
    data.education = isSkip(text) ? null : text;
  } else if (step === "attributes") {
    data.attributes = isSkip(text) ? null : text;
  }
  const next = nextPrefStep(step);
  if (!next) {
    await savePref(bot, chatId, userId, data);
    return;
  }
  await setPending(userId, { mode: "pref_wizard", step: next, data });
  await askPrefStep(bot, chatId, next, gender);
}

// ---------------------------------------------------------------------
// Search matching engine
// ---------------------------------------------------------------------
function looseMatch(candidateValue: string | null, wanted: string | null | undefined): boolean {
  if (!wanted) return true; // "لا يهم"
  if (!candidateValue) return false;
  return candidateValue.toLowerCase().includes(wanted.toLowerCase()) || wanted.toLowerCase().includes(candidateValue.toLowerCase());
}
function ageInRange(age: number, min: number | null | undefined, max: number | null | undefined): boolean {
  if (min != null && age < min) return false;
  if (max != null && age > max) return false;
  return true;
}

async function buildSearchQueue(botId: string, selfId: string, selfProfile: MatchProfile, selfPref: PartnerPreference): Promise<string[]> {
  const oppositeGender: Gender = selfProfile.gender === "MALE" ? "FEMALE" : "MALE";
  const sameCountry = selfPref.country.trim().toLowerCase() === selfProfile.country.trim().toLowerCase();

  const candidates = await prisma.matchProfile.findMany({
    where: { status: "APPROVED", isHidden: false, gender: oppositeGender, userId: { not: selfId }, user: { botId } },
    include: { user: true },
    take: 200,
  });

  const blocks = await prisma.matchBlock.findMany({ where: { OR: [{ blockerId: selfId }, { blockedId: selfId }] } });
  const blockedIds = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]).filter((id) => id !== selfId));

  const filtered: MatchProfile[] = [];
  for (const c of candidates) {
    if (blockedIds.has(c.userId)) continue;
    if (c.country.trim().toLowerCase() !== selfPref.country.trim().toLowerCase()) continue;
    if (!ageInRange(c.age, selfPref.ageMin, selfPref.ageMax)) continue;
    if (!looseMatch(c.job, selfPref.job)) continue;
    if (!looseMatch(c.education, selfPref.education)) continue;
    if (!looseMatch(c.attributes, selfPref.attributes)) continue;

    if (!sameCountry) {
      // Cross-country: mutual match — the candidate's own preference must
      // also accept self (owner spec, 2026-09-02).
      const theirPref = await prisma.partnerPreference.findUnique({ where: { userId: c.userId } });
      if (!theirPref) continue;
      if (theirPref.country.trim().toLowerCase() !== selfProfile.country.trim().toLowerCase()) continue;
      if (!ageInRange(selfProfile.age, theirPref.ageMin, theirPref.ageMax)) continue;
      if (!looseMatch(selfProfile.job, theirPref.job)) continue;
      if (!looseMatch(selfProfile.education, theirPref.education)) continue;
      if (!looseMatch(selfProfile.attributes, theirPref.attributes)) continue;
    }
    filtered.push(c);
  }

  return filtered.slice(0, 20).map((c) => c.userId);
}

function likeButtonLabel(count: number): string {
  return `❤️ إعجاب (${count})`;
}

async function sendSearchCard(bot: TelegramBot, chatId: number, targetUserId: string) {
  const [profile, targetUser, likeCount] = await Promise.all([
    prisma.matchProfile.findUnique({ where: { userId: targetUserId } }),
    prisma.matchUser.findUnique({ where: { id: targetUserId } }),
    prisma.matchLike.count({ where: { toUserId: targetUserId } }),
  ]);
  if (!profile || !targetUser) return false;

  const lines = [
    `👤 ${profile.name}، ${profile.age}`,
    `🌍 ${profile.country}`,
    profile.job ? `💼 ${profile.job}` : null,
    profile.education ? `🎓 ${profile.education}` : null,
    profile.attributes ? `📝 ${profile.attributes}` : null,
    presenceLabel(targetUser.lastActiveAt),
  ].filter((l): l is string => !!l);

  // Callback data carries the full Telegram ID, not a shortId suffix — a
  // 6-char suffix of a plain numeric Telegram ID (unlike a UUID) has real
  // collision risk between different users; the full ID easily fits
  // Telegram's 64-byte callback_data limit anyway.
  const kb = new InlineKeyboard();
  kb.text(likeButtonLabel(likeCount), `mlike|${targetUserId}`);
  const contactUrl = profile.contactMethod === "TELEGRAM" ? `https://t.me/${profile.contactValue.replace(/^@/, "")}` : `https://wa.me/${profile.contactValue.replace(/[^0-9]/g, "")}`;
  kb.url("💬 رسالة", contactUrl).row();
  kb.text("➡️ التالي", "mnext").row();
  kb.text("🚩 إبلاغ", `mreport|${targetUserId}`).text("⛔ حظر", `mblock|${targetUserId}`);

  const text = lines.join("\n");
  if (profile.photoFileId) {
    await bot.api.sendPhoto(chatId, profile.photoFileId, { caption: text, reply_markup: kb });
  } else {
    await bot.api.sendMessage(chatId, `📷 (بلا صورة)\n\n${text}`, { reply_markup: kb });
  }
  return true;
}

async function advanceSearch(bot: TelegramBot, chatId: number, userId: string, pending: Extract<PendingAction, { mode: "search_browsing" }>) {
  let idx = pending.index;
  while (idx < pending.queue.length) {
    const targetId = pending.queue[idx];
    const stillBlocked = await isMutuallyBlocked(userId, targetId);
    const stillApproved = await prisma.matchProfile.findUnique({ where: { userId: targetId }, select: { status: true } });
    if (!stillBlocked && stillApproved?.status === "APPROVED") {
      const sent = await sendSearchCard(bot, chatId, targetId);
      if (sent) {
        await setPending(userId, { mode: "search_browsing", queue: pending.queue, index: idx + 1 });
        return;
      }
    }
    idx++;
  }
  await setPending(userId, null);
  await bot.api.sendMessage(chatId, "🔚 لا يوجد المزيد من النتائج المطابقة حالياً.", { reply_markup: mainMenu() });
}

async function startSearch(bot: TelegramBot, chatId: number, userId: string, botId: string) {
  const [profile, pref] = await Promise.all([
    prisma.matchProfile.findUnique({ where: { userId } }),
    prisma.partnerPreference.findUnique({ where: { userId } }),
  ]);
  if (!profile || profile.status !== "APPROVED") {
    await bot.api.sendMessage(chatId, "⚠️ يجب إنشاء ملفك الشخصي واعتماده من الإدارة أولاً.", { reply_markup: mainMenu() });
    return;
  }
  if (!pref) {
    await bot.api.sendMessage(chatId, "⚠️ يجب تحديد مواصفات الشريك الذي تبحث عنه أولاً.", { reply_markup: mainMenu() });
    return;
  }
  const queue = await buildSearchQueue(botId, userId, profile, pref);
  if (queue.length === 0) {
    await bot.api.sendMessage(chatId, "😔 لا توجد نتائج مطابقة حالياً.", { reply_markup: mainMenu() });
    return;
  }
  await advanceSearch(bot, chatId, userId, { mode: "search_browsing", queue, index: 0 });
}

async function showLikedBy(bot: TelegramBot, chatId: number, userId: string) {
  const likes = await prisma.matchLike.findMany({ where: { toUserId: userId }, orderBy: { created_at: "desc" }, take: 20 });
  if (likes.length === 0) {
    await bot.api.sendMessage(chatId, "😔 لا يوجد أحد أعجب بملفك حتى الآن.", { reply_markup: mainMenu() });
    return;
  }
  await bot.api.sendMessage(chatId, `💌 عدد من أعجبوا بملفك: ${likes.length}`, { reply_markup: mainMenu() });
  for (const like of likes) {
    if (await isMutuallyBlocked(userId, like.fromUserId)) continue;
    const profile = await prisma.matchProfile.findUnique({ where: { userId: like.fromUserId } });
    if (!profile || profile.status !== "APPROVED" || profile.isHidden) continue;
    await sendSearchCard(bot, chatId, like.fromUserId);
  }
}

async function handleMatchCallback(bot: TelegramBot, botRow: BotRow, cq: any) {
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const tgUserId = String(cq.from.id);
  const data = String(cq.data || "");
  if (!chatId) return;

  if (data.startsWith("madmin_") || data.startsWith("mrep_")) {
    if (!SUPER_ADMIN_ID || tgUserId !== SUPER_ADMIN_ID) {
      await bot.api.answerCallbackQuery(cq.id).catch(() => null);
      return;
    }
    await handleAdminCallback(bot, botRow.id, chatId, data, cq);
    return;
  }

  const user = await ensureMatchUser(botRow.id, tgUserId);
  const pending = user.pendingAction as PendingAction | null;

  if (data.startsWith("mlike|")) {
    const targetId = data.split("|")[1];
    const target = await prisma.matchProfile.findUnique({ where: { userId: targetId } });
    if (target) {
      await prisma.matchLike.upsert({
        where: { fromUserId_toUserId: { fromUserId: tgUserId, toUserId: target.userId } },
        update: {},
        create: { fromUserId: tgUserId, toUserId: target.userId },
      }).catch(() => null);
      const count = await prisma.matchLike.count({ where: { toUserId: target.userId } });
      const kb = InlineKeyboard.from(cq.message.reply_markup.inline_keyboard);
      kb.inline_keyboard[0][0].text = likeButtonLabel(count);
      await bot.api.editMessageReplyMarkup(chatId, messageId, { reply_markup: kb }).catch(() => null);
    }
    await bot.api.answerCallbackQuery(cq.id, { text: "❤️ تم الإعجاب" }).catch(() => null);
    return;
  }
  if (data === "mnext") {
    if (pending?.mode === "search_browsing") {
      await advanceSearch(bot, chatId, tgUserId, pending);
    }
    await bot.api.answerCallbackQuery(cq.id).catch(() => null);
    return;
  }
  if (data.startsWith("mreport|")) {
    const targetId = data.split("|")[1];
    const target = await prisma.matchProfile.findUnique({ where: { userId: targetId } });
    if (target) {
      await prisma.matchReport.create({ data: { reporterId: tgUserId, targetId: target.userId, source: "SEARCH" } }).catch(() => null);
      if (SUPER_ADMIN_ID) {
        await bot.api.sendMessage(Number(SUPER_ADMIN_ID), `🚩 بلاغ جديد على ملف #${shortId(target.userId)} (${target.name}) من المستخدم ${tgUserId}.\nراجعه من «🚩 بلاغات المطابقة».`).catch(() => null);
      }
    }
    await bot.api.answerCallbackQuery(cq.id, { text: "🚩 تم إرسال بلاغك" }).catch(() => null);
    return;
  }
  if (data.startsWith("mblock|")) {
    const targetId = data.split("|")[1];
    const target = await prisma.matchProfile.findUnique({ where: { userId: targetId } });
    if (target) {
      await prisma.matchBlock.upsert({
        where: { blockerId_blockedId: { blockerId: tgUserId, blockedId: target.userId } },
        update: {},
        create: { blockerId: tgUserId, blockedId: target.userId },
      }).catch(() => null);
    }
    await bot.api.answerCallbackQuery(cq.id, { text: "⛔ تم الحظر" }).catch(() => null);
    if (pending?.mode === "search_browsing") {
      await advanceSearch(bot, chatId, tgUserId, pending);
    }
    return;
  }
  await bot.api.answerCallbackQuery(cq.id).catch(() => null);
}

// ---------------------------------------------------------------------
// Random anonymous chat
// ---------------------------------------------------------------------
async function findWaitingPartner(botId: string, selfId: string) {
  const now = new Date();
  const waiting = await prisma.randomChatQueue.findMany({
    where: { botId, status: "WAITING", expiresAt: { gt: now }, userId: { not: selfId } },
    orderBy: { created_at: "asc" },
    take: 50,
  });
  for (const w of waiting) {
    if (await isMutuallyBlocked(selfId, w.userId)) continue;
    const recentSession = await prisma.randomChatSession.findFirst({
      where: {
        OR: [
          { user1Id: selfId, user2Id: w.userId },
          { user1Id: w.userId, user2Id: selfId },
        ],
        created_at: { gt: new Date(Date.now() - SKIP_COOLDOWN_HOURS * 3600 * 1000) },
      },
    });
    if (recentSession) continue;
    return w;
  }
  return null;
}

async function startRandomChat(bot: TelegramBot, chatId: number, botRow: BotRow, tgUserId: string) {
  const partnerEntry = await findWaitingPartner(botRow.id, tgUserId);
  if (partnerEntry) {
    const session = await prisma.randomChatSession.create({ data: { user1Id: tgUserId, user2Id: partnerEntry.userId, botId: botRow.id } });
    await prisma.randomChatQueue.update({ where: { id: partnerEntry.id }, data: { status: "MATCHED", sessionId: session.id } });
    await setPending(tgUserId, { mode: "random_chatting", sessionId: session.id, partnerId: partnerEntry.userId });
    await setPending(partnerEntry.userId, { mode: "random_chatting", sessionId: session.id, partnerId: tgUserId });
    await bot.api.sendMessage(chatId, "✅ تم الاتصال! ابدأ الدردشة الآن (مجهولة الهوية بالكامل).", { reply_markup: randomChatMenu() });
    await bot.api.sendMessage(Number(partnerEntry.userId), "✅ تم الاتصال! ابدأ الدردشة الآن (مجهولة الهوية بالكامل).", { reply_markup: randomChatMenu() }).catch(() => null);
    return;
  }
  await prisma.randomChatQueue.create({
    data: { userId: tgUserId, botId: botRow.id, status: "WAITING", expiresAt: new Date(Date.now() + RANDOM_CHAT_WINDOW_SECONDS * 1000) },
  });
  await setPending(tgUserId, { mode: "random_waiting" });
  await animateSearchingMessage(bot, chatId);
}

// Brief "live searching" animation (owner request, 2026-09-05): a single
// static message reads as frozen/empty next to other bots whose search
// card visibly animates. The search itself is already real — the
// RandomChatQueue row above was just created — this only adds visual
// feedback that it's actively happening; it never fakes a search that
// isn't real. Kept to ~4s of edits (Telegram's editMessageText, not a
// GIF — text can't literally spin) so the whole request stays well
// inside the telegram webhook route's execution budget (see
// `maxDuration` in src/app/api/telegram/[botId]/route.ts) alongside the
// DB work already happening in this same request.
//
// Uses a moving block on a fixed-width progress bar (radar-style, back
// and forth) rather than a growing dot trail: an earlier version just
// changed the dot count on an otherwise-identical line, and a first
// round of owner testing (2026-09-05) read that as the line "flickering"
// rather than an intentional animation — easy to mistake for a rendering
// glitch. A bar with a block visibly sliding position reads unambiguously
// as a loading indicator instead.
const SEARCH_BAR_FRAMES = ["▓░░░░░", "░▓░░░░", "░░▓░░░", "░░░▓░░", "░░░░▓░", "░░░░░▓", "░░░▓░░", "░▓░░░░"];

async function animateSearchingMessage(bot: TelegramBot, chatId: number) {
  // No reply_markup on this message, on purpose: Telegram's Bot API
  // rejects editMessageText with "400: Bad Request: message can't be
  // edited" on ANY message that was sent carrying a ReplyKeyboardMarkup
  // (the persistent bottom keyboard) — confirmed via production logs,
  // 2026-09-05, where every single edit below failed with exactly that
  // error. Inline keyboards (see the working carousel in adBotLogic.ts)
  // don't have this restriction; reply keyboards do. We don't lose the
  // retry button by dropping it here: the visitor can only reach this
  // function by having just pressed "🔀 مراسلة عشوائية" on whatever
  // keyboard was already showing (mainMenu, or this same waiting keyboard
  // from an earlier press) — that keyboard stays untouched and the button
  // is still right there.
  const label = "🔍 جاري البحث عن شريك للمحادثة...";
  let msg;
  try {
    msg = await bot.api.sendMessage(chatId, `${label}\n${SEARCH_BAR_FRAMES[0]}`);
  } catch (e) {
    console.error("[randomChat] initial sendMessage FAILED", e);
    return;
  }
  for (const bar of SEARCH_BAR_FRAMES.slice(1)) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    await bot.api
      .editMessageText(chatId, msg.message_id, `${label}\n${bar}`)
      .catch((e) => console.error("[randomChat] edit FAILED", e));
  }
  await new Promise((resolve) => setTimeout(resolve, 650));
  await bot.api
    .editMessageText(
      chatId,
      msg.message_id,
      "🔍 يتم البحث الآن عن شريك للمحادثة... إن لم يُعثر على أحد خلال دقيقة واحدة، اضغط الزر مجدداً للتحقق."
    )
    .catch((e) => console.error("[randomChat] final edit FAILED", e));
}

async function endRandomChat(bot: TelegramBot, tgUserId: string, sessionId: string, partnerId: string, reason: "end" | "block") {
  await prisma.randomChatSession.update({ where: { id: sessionId }, data: { status: "ENDED", ended_at: new Date() } }).catch(() => null);
  if (reason === "block") {
    await prisma.matchBlock.upsert({
      where: { blockerId_blockedId: { blockerId: tgUserId, blockedId: partnerId } },
      update: {},
      create: { blockerId: tgUserId, blockedId: partnerId },
    }).catch(() => null);
  }
  await setPending(tgUserId, null);
  await setPending(partnerId, null);
  await bot.api.sendMessage(Number(tgUserId), "انتهت المحادثة.", { reply_markup: mainMenu() }).catch(() => null);
  await bot.api.sendMessage(Number(partnerId), "انتهت المحادثة.", { reply_markup: mainMenu() }).catch(() => null);
}

// ---------------------------------------------------------------------
// SUPER_ADMIN moderation (text commands, same convention as adBotLogic)
// ---------------------------------------------------------------------
async function applyProfileDecision(bot: TelegramBot, adminChatId: number, profile: MatchProfile, approve: boolean) {
  await prisma.matchProfile.update({ where: { userId: profile.userId }, data: { status: approve ? "APPROVED" : "REJECTED" } });
  await bot.api.sendMessage(adminChatId, approve ? `✅ تم اعتماد ملف ${profile.name}.` : `❌ تم رفض ملف ${profile.name}.`);
  await bot.api
    .sendMessage(
      Number(profile.userId),
      approve ? "✅ تم اعتماد ملفك الشخصي! يمكنك الآن استخدام «🔍 البحث عن شريك»." : "❌ لم تتم الموافقة على ملفك الشخصي. راجع بياناتك من «👤 ملفي الشخصي» وحاول مجدداً."
    )
    .catch(() => null);
}

async function decideProfile(bot: TelegramBot, chatId: number, idSuffix: string, approve: boolean) {
  const candidates = await prisma.matchProfile.findMany({ where: { status: "PENDING" }, take: 200 });
  const profile = candidates.find((p) => shortId(p.userId) === idSuffix);
  if (!profile) {
    await bot.api.sendMessage(chatId, "الملف غير موجود أو رُوجع مسبقاً.");
    return;
  }
  await applyProfileDecision(bot, chatId, profile, approve);
}

async function decideProfileByUserId(bot: TelegramBot, chatId: number, userId: string, approve: boolean) {
  const profile = await prisma.matchProfile.findUnique({ where: { userId } });
  if (!profile || profile.status !== "PENDING") {
    await bot.api.sendMessage(chatId, "الملف غير موجود أو رُوجع مسبقاً.");
    return;
  }
  await applyProfileDecision(bot, chatId, profile, approve);
}

async function sendAdminStats(bot: TelegramBot, chatId: number) {
  const onlineSince = new Date(Date.now() - ONLINE_THRESHOLD_MINUTES * 60000);
  // The SUPER_ADMIN also gets a MatchUser row (purely to store their own
  // pendingAction state for the broadcast/lookup/unban flows below) — it
  // must never count as a real platform user in these stats.
  const notAdmin = { id: { not: SUPER_ADMIN_ID || "__none__" } };
  const [totalUsers, onlineUsers, pendingProfiles, approvedProfiles, rejectedProfiles, pendingSearchReports, pendingChatReports, activeSessions, waitingQueue, pendingInbox] = await Promise.all([
    prisma.matchUser.count({ where: notAdmin }),
    prisma.matchUser.count({ where: { ...notAdmin, lastActiveAt: { gte: onlineSince } } }),
    prisma.matchProfile.count({ where: { status: "PENDING" } }),
    prisma.matchProfile.count({ where: { status: "APPROVED" } }),
    prisma.matchProfile.count({ where: { status: "REJECTED" } }),
    prisma.matchReport.count({ where: { status: "PENDING", source: "SEARCH" } }),
    prisma.matchReport.count({ where: { status: "PENDING", source: "RANDOM_CHAT" } }),
    prisma.randomChatSession.count({ where: { status: "ACTIVE" } }),
    prisma.randomChatQueue.count({ where: { status: "WAITING", expiresAt: { gt: new Date() } } }),
    prisma.adminMessage.count({ where: { status: "PENDING" } }),
  ]);
  const text =
    `📊 إحصائيات بوت التعارف\n\n` +
    `👥 إجمالي المستخدمين: ${totalUsers}\n` +
    `🟢 متصلون الآن: ${onlineUsers}\n\n` +
    `📋 الملفات الشخصية:\n⏳ بانتظار المراجعة: ${pendingProfiles}\n✅ معتمدة: ${approvedProfiles}\n❌ مرفوضة: ${rejectedProfiles}\n\n` +
    `🚩 البلاغات بانتظار المراجعة:\n🔍 من البحث: ${pendingSearchReports}\n🔀 من المحادثة العشوائية: ${pendingChatReports}\n\n` +
    `🔀 المحادثة العشوائية الآن:\n💬 محادثات نشطة: ${activeSessions}\n⏳ بانتظار شريك: ${waitingQueue}\n\n` +
    `📥 رسائل واردة غير مقروءة: ${pendingInbox}`;
  await bot.api.sendMessage(chatId, text);
}

async function sendPendingProfilesList(bot: TelegramBot, chatId: number) {
  const profiles = await prisma.matchProfile.findMany({ where: { status: "PENDING" }, orderBy: { created_at: "asc" }, take: 20 });
  if (profiles.length === 0) {
    await bot.api.sendMessage(chatId, "✅ لا توجد ملفات بانتظار المراجعة حالياً.");
    return;
  }
  for (const profile of profiles) {
    await notifyAdminNewProfile(bot, profile);
  }
}

async function sendPendingReportsList(bot: TelegramBot, chatId: number, source: "SEARCH" | "RANDOM_CHAT") {
  const reports = await prisma.matchReport.findMany({ where: { status: "PENDING", source }, orderBy: { created_at: "asc" }, take: 20 });
  if (reports.length === 0) {
    await bot.api.sendMessage(chatId, "✅ لا توجد بلاغات بانتظار المراجعة في هذا القسم.");
    return;
  }
  for (const r of reports) {
    const [reporterProfile, targetProfile] = await Promise.all([
      prisma.matchProfile.findUnique({ where: { userId: r.reporterId } }),
      prisma.matchProfile.findUnique({ where: { userId: r.targetId } }),
    ]);
    const text =
      `🚩 بلاغ ${source === "SEARCH" ? "من نتائج البحث" : "من محادثة عشوائية مجهولة"}\n\n` +
      `المُبلِّغ: ${reporterProfile?.name || "بلا ملف"} (#${shortId(r.reporterId)})\n` +
      `المُبلَّغ عنه: ${targetProfile?.name || "بلا ملف"} (#${shortId(r.targetId)})\n` +
      `${relativeTime(r.created_at)}`;
    const kb = new InlineKeyboard()
      .text("🙈 تجاهل", `mrep_ignore|${r.id}`)
      .text("🔇 كتم 24س", `mrep_mute|${r.id}`)
      .row()
      .text("⛔ حظر نهائي", `mrep_ban|${r.id}`);
    await bot.api.sendMessage(chatId, text, { reply_markup: kb }).catch(() => null);
  }
}

function inboxMessageKb(messageId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("↩️ رد", `madmin_msgreply|${messageId}`)
    .text("✅ تحديد كمقروء", `madmin_msgread|${messageId}`)
    .row()
    .text("🔇 كتم المرسل", `madmin_msgmute|${messageId}`)
    .text("⛔ حظر المرسل", `madmin_msgban|${messageId}`);
}

async function sendInboxMessages(bot: TelegramBot, chatId: number) {
  const messages = await prisma.adminMessage.findMany({ where: { status: "PENDING" }, orderBy: { created_at: "asc" }, take: 20 });
  if (messages.length === 0) {
    await bot.api.sendMessage(chatId, "✅ لا توجد رسائل واردة جديدة.");
    return;
  }
  for (const m of messages) {
    const senderProfile = await prisma.matchProfile.findUnique({ where: { userId: m.senderId } });
    const text = `📩 رسالة من ${senderProfile?.name || "بلا ملف"} (#${shortId(m.senderId)})\n🆔 ${m.senderId}\n${relativeTime(m.created_at)}\n\n${m.text}`;
    await bot.api.sendMessage(chatId, text, { reply_markup: inboxMessageKb(m.id) }).catch(() => null);
  }
}

async function runBroadcast(bot: TelegramBot, chatId: number, text: string) {
  const recipients = await prisma.matchUser.findMany({
    where: { phoneVerified: true, isBanned: false, id: { not: SUPER_ADMIN_ID || "__none__" } },
    select: { id: true },
  });
  let sent = 0;
  for (const r of recipients) {
    try {
      await bot.api.sendMessage(Number(r.id), `📢 إعلان من إدارة البوت:\n\n${text}`);
      sent++;
    } catch {
      // user blocked the bot or is unreachable — skip and keep going
    }
  }
  await bot.api.sendMessage(chatId, `✅ تم إرسال البث إلى ${sent} من أصل ${recipients.length} مستخدم.`);
}

async function sendUserLookup(bot: TelegramBot, chatId: number, rawId: string) {
  const targetId = rawId.replace(/[^0-9]/g, "");
  if (!targetId) {
    await bot.api.sendMessage(chatId, "آيدي غير صالح.");
    return;
  }
  const user = await prisma.matchUser.findUnique({ where: { id: targetId } });
  if (!user) {
    await bot.api.sendMessage(chatId, "لم يتم العثور على مستخدم بهذا الآيدي.");
    return;
  }
  const profile = await prisma.matchProfile.findUnique({ where: { userId: targetId } });
  const [likesReceived, reportsReceived, reportsGiven] = await Promise.all([
    prisma.matchLike.count({ where: { toUserId: targetId } }),
    prisma.matchReport.count({ where: { targetId } }),
    prisma.matchReport.count({ where: { reporterId: targetId } }),
  ]);
  const lines = [
    `🆔 ${targetId}`,
    `📱 تحقق الهاتف: ${user.phoneVerified ? "✅" : "❌"}`,
    `🚫 محظور: ${user.isBanned ? "نعم" : "لا"}`,
    `🔇 مكتوم: ${user.mutedUntil && user.mutedUntil > new Date() ? `نعم حتى ${user.mutedUntil.toLocaleString("ar")}` : "لا"}`,
    `❤️ إعجابات مستلمة: ${likesReceived}`,
    `🚩 بلاغات ضده: ${reportsReceived}`,
    `🚩 بلاغات قدّمها: ${reportsGiven}`,
  ];
  const profileText = profile
    ? `\n\n👤 الملف الشخصي:\nالاسم: ${profile.name}\nالحالة: ${profile.status === "APPROVED" ? "✅ معتمد" : profile.status === "REJECTED" ? "❌ مرفوض" : "⏳ قيد المراجعة"}\nمخفي عن البحث: ${profile.isHidden ? "نعم" : "لا"}`
    : "\n\n👤 لا يوجد ملف شخصي لهذا المستخدم.";
  const text = lines.join("\n") + profileText;
  const opts = profile?.status === "PENDING" ? { reply_markup: new InlineKeyboard().text("✅ قبول الملف", `madmin_approve|${targetId}`).text("❌ رفض الملف", `madmin_reject|${targetId}`) } : {};
  if (profile?.photoFileId) {
    await bot.api.sendPhoto(chatId, profile.photoFileId, { caption: text, ...opts });
  } else {
    await bot.api.sendMessage(chatId, text, opts);
  }
}

async function runUnban(bot: TelegramBot, chatId: number, rawId: string) {
  const targetId = rawId.replace(/[^0-9]/g, "");
  if (!targetId) {
    await bot.api.sendMessage(chatId, "آيدي غير صالح.");
    return;
  }
  const user = await prisma.matchUser.findUnique({ where: { id: targetId } });
  if (!user) {
    await bot.api.sendMessage(chatId, "لم يتم العثور على مستخدم بهذا الآيدي.");
    return;
  }
  await prisma.matchUser.update({ where: { id: targetId }, data: { isBanned: false, mutedUntil: null } });
  await bot.api.sendMessage(chatId, `✅ تم رفع الحظر/الكتم عن المستخدم ${targetId}.`);
  await bot.api.sendMessage(Number(targetId), "✅ تم رفع الحظر/الكتم عنك من قِبل الإدارة، يمكنك استخدام البوت الآن.").catch(() => null);
}

async function handleAdminMessage(bot: TelegramBot, chatId: number, text: string, adminId: string) {
  if (text === "/start") {
    await bot.api.sendMessage(chatId, "🛠 لوحة تحكم مشرف بوت التعارف والزواج.", { reply_markup: adminMenu() });
    return;
  }
  if (text === "📊 الإحصائيات") {
    await sendAdminStats(bot, chatId);
    return;
  }
  if (text === "📋 الملفات المعلقة") {
    await sendPendingProfilesList(bot, chatId);
    return;
  }
  if (text === "🚩 بلاغات المطابقة") {
    await sendPendingReportsList(bot, chatId, "SEARCH");
    return;
  }
  if (text === "🚩 بلاغات الدردشة العشوائية") {
    await sendPendingReportsList(bot, chatId, "RANDOM_CHAT");
    return;
  }
  if (text === "📢 بث جماعي") {
    await setPending(adminId, { mode: "admin_broadcast" });
    await bot.api.sendMessage(chatId, "📢 أرسل نص الرسالة التي تريد بثّها لجميع المستخدمين المُفعّلين. لإلغاء العملية اضغط أي زر آخر من القائمة.");
    return;
  }
  if (text === "🔎 بحث عن مستخدم") {
    await setPending(adminId, { mode: "admin_lookup" });
    await bot.api.sendMessage(chatId, "🔎 أرسل آيدي المستخدم (Telegram ID):");
    return;
  }
  if (text === "🔓 رفع حظر/كتم") {
    await setPending(adminId, { mode: "admin_unban" });
    await bot.api.sendMessage(chatId, "🔓 أرسل آيدي المستخدم الذي تريد رفع الحظر/الكتم عنه:");
    return;
  }
  if (text === "📥 الرسائل الواردة") {
    await sendInboxMessages(bot, chatId);
    return;
  }
  if (text.startsWith("موافقة ملف ") || text.startsWith("رفض ملف ")) {
    const approve = text.startsWith("موافقة ملف ");
    const idSuffix = text.split(" ")[2]?.trim();
    if (idSuffix) await decideProfile(bot, chatId, idSuffix, approve);
    return;
  }
  await bot.api.sendMessage(chatId, "🛠 لوحة تحكم مشرف بوت التعارف والزواج.", { reply_markup: adminMenu() });
}

async function handleAdminCallback(bot: TelegramBot, botId: string, chatId: number, data: string, cq: any) {
  if (data.startsWith("madmin_approve|") || data.startsWith("madmin_reject|")) {
    const approve = data.startsWith("madmin_approve|");
    const userId = data.split("|")[1];
    await decideProfileByUserId(bot, chatId, userId, approve);
    await bot.api.answerCallbackQuery(cq.id, { text: approve ? "✅ تم القبول" : "❌ تم الرفض" }).catch(() => null);
    return;
  }
  if (data.startsWith("madmin_msgread|")) {
    const msgId = data.split("|")[1];
    await prisma.adminMessage.update({ where: { id: msgId }, data: { status: "READ" } }).catch(() => null);
    await bot.api.answerCallbackQuery(cq.id, { text: "✅ تم التحديد كمقروء" }).catch(() => null);
    return;
  }
  if (data.startsWith("madmin_msgban|") || data.startsWith("madmin_msgmute|")) {
    const msgId = data.split("|")[1];
    const inboxMsg = await prisma.adminMessage.findUnique({ where: { id: msgId } });
    if (!inboxMsg) {
      await bot.api.answerCallbackQuery(cq.id, { text: "الرسالة غير موجودة." }).catch(() => null);
      return;
    }
    if (data.startsWith("madmin_msgban|")) {
      await prisma.matchUser.update({ where: { id: inboxMsg.senderId }, data: { isBanned: true } }).catch(() => null);
      await bot.api.sendMessage(chatId, "⛔ تم حظر المستخدم نهائياً من البوت لتجاوزه التحذير.");
    } else {
      await prisma.matchUser.update({ where: { id: inboxMsg.senderId }, data: { mutedUntil: new Date(Date.now() + 24 * 3600 * 1000) } }).catch(() => null);
      await bot.api.sendMessage(chatId, "🔇 تم كتم المستخدم لمدة 24 ساعة.");
    }
    await prisma.adminMessage.update({ where: { id: msgId }, data: { status: "READ" } }).catch(() => null);
    await bot.api.answerCallbackQuery(cq.id).catch(() => null);
    return;
  }
  if (data.startsWith("madmin_msgreply|")) {
    const msgId = data.split("|")[1];
    const inboxMsg = await prisma.adminMessage.findUnique({ where: { id: msgId } });
    if (!inboxMsg) {
      await bot.api.answerCallbackQuery(cq.id, { text: "الرسالة غير موجودة." }).catch(() => null);
      return;
    }
    await ensureMatchUser(botId, String(cq.from.id));
    await setPending(String(cq.from.id), { mode: "admin_reply", targetUserId: inboxMsg.senderId, messageId: msgId });
    await bot.api.sendMessage(chatId, "↩️ اكتب ردك الآن وسيصل مباشرة إلى المُرسل:");
    await bot.api.answerCallbackQuery(cq.id).catch(() => null);
    return;
  }
  if (data.startsWith("mrep_")) {
    const [action, reportId] = data.split("|");
    const report = await prisma.matchReport.findUnique({ where: { id: reportId } });
    if (!report) {
      await bot.api.answerCallbackQuery(cq.id, { text: "البلاغ غير موجود." }).catch(() => null);
      return;
    }
    if (report.status === "REVIEWED") {
      await bot.api.answerCallbackQuery(cq.id, { text: "تمت مراجعة هذا البلاغ مسبقاً." }).catch(() => null);
      return;
    }
    await prisma.matchReport.update({ where: { id: reportId }, data: { status: "REVIEWED" } });
    if (action === "mrep_ban") {
      await prisma.matchUser.update({ where: { id: report.targetId }, data: { isBanned: true } }).catch(() => null);
      await bot.api.sendMessage(chatId, "⛔ تم حظر المستخدم المُبلَّغ عنه نهائياً من البوت.");
    } else if (action === "mrep_mute") {
      await prisma.matchUser.update({ where: { id: report.targetId }, data: { mutedUntil: new Date(Date.now() + 24 * 3600 * 1000) } }).catch(() => null);
      await bot.api.sendMessage(chatId, "🔇 تم كتم المستخدم لمدة 24 ساعة.");
    } else {
      await bot.api.sendMessage(chatId, "🙈 تم تجاهل البلاغ.");
    }
    await bot.api.answerCallbackQuery(cq.id).catch(() => null);
    return;
  }
  await bot.api.answerCallbackQuery(cq.id).catch(() => null);
}

// ---------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------
export async function handleMarriageBotUpdate(bot: TelegramBot, botRow: BotRow, update: any) {
  if (update.callback_query) {
    await handleMatchCallback(bot, botRow, update.callback_query);
    return;
  }
  const msg = update.message;
  if (!msg?.from || !msg.chat) return;
  const chatId = msg.chat.id;
  const tgUserId = String(msg.from.id);

  if (SUPER_ADMIN_ID && tgUserId === SUPER_ADMIN_ID) {
    const text = String(msg.text || "").trim();
    if (!text) return;
    // The admin gets a MatchUser row too, purely to persist their own
    // pendingAction between messages (broadcast/lookup/unban each need a
    // follow-up message) — excluded from all user-facing stats/broadcasts.
    const adminUser = await ensureMatchUser(botRow.id, tgUserId);
    const adminPending = adminUser.pendingAction as PendingAction | null;
    if (adminPending && !ADMIN_COMMANDS.has(text)) {
      await setPending(tgUserId, null);
      if (adminPending.mode === "admin_broadcast") {
        await runBroadcast(bot, chatId, text);
        return;
      }
      if (adminPending.mode === "admin_lookup") {
        await sendUserLookup(bot, chatId, text);
        return;
      }
      if (adminPending.mode === "admin_unban") {
        await runUnban(bot, chatId, text);
        return;
      }
      if (adminPending.mode === "admin_reply") {
        await bot.api.sendMessage(Number(adminPending.targetUserId), `↩️ رد من الإدارة:\n\n${text}`).catch(() => null);
        await prisma.adminMessage.update({ where: { id: adminPending.messageId }, data: { status: "READ" } }).catch(() => null);
        await bot.api.sendMessage(chatId, "✅ تم إرسال ردك إلى المستخدم.");
        return;
      }
    }
    if (adminPending) await setPending(tgUserId, null);
    await handleAdminMessage(bot, chatId, text, tgUserId);
    return;
  }

  const user = await ensureMatchUser(botRow.id, tgUserId);
  await prisma.matchUser.update({ where: { id: tgUserId }, data: { lastActiveAt: new Date() } }).catch(() => null);

  if (user.isBanned) {
    await bot.api.sendMessage(chatId, "🚫 تم حظرك من استخدام هذا البوت من قِبل الإدارة.");
    return;
  }
  if (user.mutedUntil && user.mutedUntil > new Date()) {
    await bot.api.sendMessage(chatId, "🔇 أنت مكتوم مؤقتاً بسبب مخالفة بلّغ عنها أحد المستخدمين. حاول لاحقاً.");
    return;
  }

  if (msg.contact) {
    if (String(msg.contact.user_id) === tgUserId) {
      await prisma.matchUser.update({ where: { id: tgUserId }, data: { phoneNumber: msg.contact.phone_number, phoneVerified: true } });
      await bot.api.sendMessage(chatId, "✅ تم التحقق من رقم هاتفك.", { reply_markup: mainMenu() });
    } else {
      await bot.api.sendMessage(chatId, "⚠️ يجب مشاركة رقم هاتفك أنت، وليس رقم شخص آخر.");
    }
    return;
  }

  if (!user.phoneVerified) {
    await bot.api.sendMessage(
      chatId,
      "📱 التحقق من رقم الهاتف خطوة إلزامية قبل استخدام هذا البوت، لحماية جميع الأعضاء.",
      { reply_markup: new Keyboard().requestContact("📱 مشاركة رقم الهاتف").resized() }
    );
    return;
  }

  const pending = user.pendingAction as PendingAction | null;

  // Photo step must be checked before the text-only bailout below.
  if (msg.photo && pending?.mode === "profile_wizard" && pending.step === "photo") {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    await saveProfile(bot, chatId, tgUserId, pending.data, fileId);
    return;
  }

  const text = String(msg.text || "").trim();
  if (!text) return;

  if (isBack(text)) {
    if (pending?.mode === "random_chatting") {
      await endRandomChat(bot, tgUserId, pending.sessionId, pending.partnerId, "end");
      return;
    }
    await setPending(tgUserId, null);
    await bot.api.sendMessage(chatId, "🏠 القائمة الرئيسية:", { reply_markup: mainMenu() });
    return;
  }

  if (text === "/start") {
    await setPending(tgUserId, null);
    await bot.api.sendMessage(chatId, "أهلاً بك 👋", { reply_markup: mainMenu() });
    return;
  }

  // Active random chat: relay text, or handle its own control buttons.
  if (pending?.mode === "random_chatting") {
    if (text === "⏹ إنهاء المحادثة") {
      await endRandomChat(bot, tgUserId, pending.sessionId, pending.partnerId, "end");
      return;
    }
    if (text === "⛔ حظر") {
      await endRandomChat(bot, tgUserId, pending.sessionId, pending.partnerId, "block");
      return;
    }
    if (text === "🚩 إبلاغ") {
      await prisma.matchReport.create({ data: { reporterId: tgUserId, targetId: pending.partnerId, source: "RANDOM_CHAT" } }).catch(() => null);
      if (SUPER_ADMIN_ID) {
        await bot.api.sendMessage(Number(SUPER_ADMIN_ID), `🚩 بلاغ من محادثة عشوائية — المُبلِّغ ${tgUserId} ضد ${pending.partnerId}.\nراجعه من «🚩 بلاغات الدردشة العشوائية».`).catch(() => null);
      }
      await bot.api.sendMessage(chatId, "🚩 تم إرسال بلاغك.");
      return;
    }
    await bot.api.sendMessage(Number(pending.partnerId), text).catch(() => null);
    return;
  }

  if (pending?.mode === "random_waiting" && text === "🔀 مراسلة عشوائية") {
    await startRandomChat(bot, chatId, botRow, tgUserId);
    return;
  }

  if (text === "👤 ملفي الشخصي") {
    const profile = await prisma.matchProfile.findUnique({ where: { userId: tgUserId } });
    if (!profile) {
      await startProfileWizard(bot, chatId, tgUserId);
      return;
    }
    const statusLabel = profile.status === "APPROVED" ? "✅ معتمد" : profile.status === "REJECTED" ? "❌ مرفوض" : "⏳ قيد المراجعة";
    const visibilityLabel = profile.isHidden ? "⏸ مخفي عن نتائج البحث" : "🟢 ظاهر في نتائج البحث";
    const toggleLabel = profile.isHidden ? "▶️ إظهار ملفي" : "⏸ إخفاء ملفي مؤقتاً";
    const infoText = `👤 ملفك الشخصي\n\nالاسم: ${profile.name}\nالعمر: ${profile.age}\nالدولة: ${profile.country}\nالحالة: ${statusLabel}\nالظهور: ${visibilityLabel}\n\nلتعديل الملف أرسل «✏️ تعديل».`;
    const kb = new Keyboard().text("✏️ تعديل").text(toggleLabel).row().text("🗑 حذف ملفي نهائياً").row().text(backLabel()).resized();
    if (profile.photoFileId) {
      await bot.api.sendPhoto(chatId, profile.photoFileId, { caption: infoText, reply_markup: kb });
    } else {
      await bot.api.sendMessage(chatId, infoText, { reply_markup: kb });
    }
    return;
  }
  if (text === "✏️ تعديل") {
    await startProfileWizard(bot, chatId, tgUserId);
    return;
  }
  if (text === "⏸ إخفاء ملفي مؤقتاً" || text === "▶️ إظهار ملفي") {
    const profile = await prisma.matchProfile.findUnique({ where: { userId: tgUserId } });
    if (!profile) {
      await bot.api.sendMessage(chatId, "لا يوجد ملف شخصي بعد.", { reply_markup: mainMenu() });
      return;
    }
    const newHidden = !profile.isHidden;
    await prisma.matchProfile.update({ where: { userId: tgUserId }, data: { isHidden: newHidden } });
    await bot.api.sendMessage(
      chatId,
      newHidden ? "⏸ تم إخفاء ملفك مؤقتاً عن نتائج البحث." : "▶️ تم إظهار ملفك في نتائج البحث مجدداً.",
      { reply_markup: mainMenu() }
    );
    return;
  }
  if (text === "🗑 حذف ملفي نهائياً") {
    const profile = await prisma.matchProfile.findUnique({ where: { userId: tgUserId } });
    if (!profile) {
      await bot.api.sendMessage(chatId, "لا يوجد ملف شخصي لحذفه.", { reply_markup: mainMenu() });
      return;
    }
    await setPending(tgUserId, { mode: "confirm_delete_profile" });
    await bot.api.sendMessage(
      chatId,
      "⚠️ هل أنت متأكد من حذف ملفك الشخصي نهائياً؟ لن تظهر بعدها في نتائج بحث أحد، ولا يمكن التراجع عن هذا.",
      { reply_markup: confirmDeleteMenu() }
    );
    return;
  }
  if (pending?.mode === "confirm_delete_profile") {
    if (text === DELETE_CONFIRM_LABEL) {
      await prisma.matchProfile.delete({ where: { userId: tgUserId } }).catch(() => null);
      await setPending(tgUserId, null);
      await bot.api.sendMessage(chatId, "🗑 تم حذف ملفك الشخصي نهائياً. يمكنك إنشاء ملف جديد في أي وقت.", { reply_markup: mainMenu() });
    } else {
      await setPending(tgUserId, null);
      await bot.api.sendMessage(chatId, "تم الإلغاء.", { reply_markup: mainMenu() });
    }
    return;
  }
  if (text === "💍 مواصفات الشريك") {
    const profile = await prisma.matchProfile.findUnique({ where: { userId: tgUserId } });
    await startPrefWizard(bot, chatId, tgUserId, profile?.gender as Gender | undefined);
    return;
  }
  if (text === "🔍 البحث عن شريك") {
    await startSearch(bot, chatId, tgUserId, botRow.id);
    return;
  }
  if (text === "🔀 مراسلة عشوائية") {
    await startRandomChat(bot, chatId, botRow, tgUserId);
    return;
  }
  if (text === "💌 من أعجب بي") {
    await showLikedBy(bot, chatId, tgUserId);
    return;
  }
  if (text === "ℹ️ معلومات") {
    await bot.api.sendMessage(
      chatId,
      "ℹ️ عن هذا البوت\n\n" +
        "🤖 بوت تعارف وزواج شرعي يعمل بخوارزمية مطابقة ذكية تحلّل ملفك الشخصي ومواصفات الشريك الذي تبحث عنه لإيجاد الأنسب لك تلقائياً.\n" +
        "🟢 البوت متصل الآن ويعمل على مدار الساعة.\n\n" +
        "📌 طريقة الاستخدام:\n" +
        "1️⃣ أنشئ ملفك الشخصي من «👤 ملفي الشخصي»\n" +
        "2️⃣ حدد مواصفات الشريك الذي تبحث عنه من «💍 مواصفات الشريك»\n" +
        "3️⃣ اضغط «🔍 البحث عن شريك» لعرض الملفات المطابقة\n" +
        "4️⃣ أو جرّب «🔀 مراسلة عشوائية» للتعارف المجهول الفوري\n\n" +
        "🔒 خصوصيتك محفوظة: لا تُشارَك بياناتك مع أي طرف حتى تختار أنت بدء التواصل.\n" +
        "🛡 كل ملف جديد يخضع لمراجعة يدوية من الإدارة قبل ظهوره في نتائج البحث.",
      { reply_markup: infoMenu() }
    );
    return;
  }
  if (text === "📩 مراسلة الأدمن") {
    await bot.api.sendMessage(chatId, CONTACT_ADMIN_WARNING, { reply_markup: contactAdminConfirmMenu() });
    return;
  }
  if (text === "🔗 دعوة رابط البوت") {
    const me = await bot.api.getMe();
    await bot.api.sendMessage(chatId, `🔗 شارك هذا الرابط مع أصدقائك لدعوتهم لاستخدام البوت:\n\nhttps://t.me/${me.username}`, { reply_markup: infoMenu() });
    return;
  }
  if (text === CONTACT_ADMIN_CONFIRM_LABEL) {
    await setPending(tgUserId, { mode: "contact_admin_compose" });
    await bot.api.sendMessage(chatId, "✍️ اكتب رسالتك للإدارة الآن وأرسلها في رسالة واحدة:", { reply_markup: plainBackMenu() });
    return;
  }
  if (pending?.mode === "contact_admin_compose") {
    const savedMsg = await prisma.adminMessage.create({ data: { senderId: tgUserId, text } });
    await setPending(tgUserId, null);
    await bot.api.sendMessage(chatId, "✅ تم إرسال رسالتك إلى الإدارة.", { reply_markup: mainMenu() });
    if (SUPER_ADMIN_ID) {
      const senderProfile = await prisma.matchProfile.findUnique({ where: { userId: tgUserId } });
      await bot.api
        .sendMessage(
          Number(SUPER_ADMIN_ID),
          `📩 رسالة جديدة من مستخدم\n\nمن: ${senderProfile?.name || "بلا ملف"} (#${shortId(tgUserId)})\n\n${text}`,
          { reply_markup: inboxMessageKb(savedMsg.id) }
        )
        .catch(() => null);
    }
    return;
  }

  if (pending?.mode === "profile_wizard") {
    await consumeProfileStep(bot, chatId, tgUserId, pending, text);
    return;
  }
  if (pending?.mode === "pref_wizard") {
    const profile = await prisma.matchProfile.findUnique({ where: { userId: tgUserId } });
    await consumePrefStep(bot, chatId, tgUserId, pending, text, profile?.gender as Gender | undefined);
    return;
  }

  await bot.api.sendMessage(chatId, "اختر من القائمة.", { reply_markup: mainMenu() });
}
