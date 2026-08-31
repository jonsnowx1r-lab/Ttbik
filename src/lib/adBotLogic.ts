import { Bot as TelegramBot, InlineKeyboard } from "grammy";
import { prisma } from "@/lib/prisma";
import type { Bot as BotRow } from "@prisma/client";

/**
 * AD_BOT template — literal implementation of the Multi-Tenant Telegram Bot
 * Platform blueprint the owner supplied (2026-08-31), built on grammy +
 * Prisma exactly as specified. Two additions beyond the literal snippets,
 * both hard technical/financial necessities rather than design choices:
 *
 * 1. `User.pendingAction` (Prisma) tracks a mid-flight multi-step
 *    conversation (e.g. "creating an ad, waiting for the budget"). Vercel
 *    serverless functions don't keep in-memory state between requests, so
 *    grammy's default session middleware would silently lose the flow on a
 *    cold start — this is what actually makes "ضع إعلانك" work reliably.
 * 2. Double-claim protection on `taskdone:<adId>` via a synthetic unique
 *    `Transaction.txHash` (`task_<adId>_<userId>`) — without it, repeatedly
 *    tapping "تأكيد" would drain an ad's budget infinitely, since the
 *    blueprint's snippets never included a completions-ledger table.
 *
 * Revenue split (per completed task, computed once at ad creation and
 * reused every time someone completes it): 50% worker / 20% bot creator /
 * 30% platform — owner's own numbers from the "توزيع الأرباح" spec.
 */

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || "";
const MIN_CPC = 0.02;
const MIN_WITHDRAWAL = 1;

type AdTypeStr = "LINK" | "TELEGRAM" | "YOUTUBE" | "TWITTER" | "TIKTOK" | "FACEBOOK" | "INSTAGRAM";
const AD_TYPES: AdTypeStr[] = ["LINK", "TELEGRAM", "YOUTUBE", "TWITTER", "TIKTOK", "FACEBOOK", "INSTAGRAM"];
const TYPE_LABEL: Record<AdTypeStr, string> = {
  LINK: "🔗 رابط",
  TELEGRAM: "📢 قناة تلجرام",
  YOUTUBE: "▶️ يوتيوب",
  TWITTER: "🐦 تويتر/X",
  TIKTOK: "🎵 تيك توك",
  FACEBOOK: "📘 فيسبوك",
  INSTAGRAM: "📸 انستغرام",
};
const NEEDS_DESCRIPTION: AdTypeStr[] = ["YOUTUBE", "TIKTOK", "FACEBOOK", "INSTAGRAM"];

type CreateAdCollected = { subType?: "retweet" | "follow"; description?: string; target?: string; budget?: number; cpc?: number };
type PendingAction =
  | { mode: "create_ad"; type: AdTypeStr; step: "subtype" | "description" | "target" | "budget" | "cpc" | "review"; collected: CreateAdCollected }
  | { mode: "withdraw"; step: "amount" }
  | { mode: "admin_broadcast" }
  | { mode: "admin_global_ad"; type: AdTypeStr };

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

function mainMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text("👀 شاهد واربح", "watch_earn")
    .text("➕ ضع إعلانك", "create_ad")
    .row()
    .text("💰 المحفظة", "wallet")
    .text("🙌 الإحالات", "referrals")
    .row()
    .text("📊 إحصائيات", "stats");
}

function typeKeyboard(prefix: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  AD_TYPES.forEach((t, i) => {
    kb.text(TYPE_LABEL[t], `${prefix}:${t}`);
    if (i % 2 === 1) kb.row();
  });
  if (AD_TYPES.length % 2 === 1) kb.row();
  kb.text("⬅️ رجوع", "back_main");
  return kb;
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
  if (update.callback_query) {
    await handleCallback(bot, botRow, update.callback_query);
    return;
  }
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
    await bot.api.sendMessage(chatId, "🚀 مرحباً بك في منصة الإعلانات!\nاختر من القائمة أدناه:", { reply_markup: mainMenu() });
    return;
  }

  if (text === "/admin") {
    if (tgUserId !== SUPER_ADMIN_ID) {
      await bot.api.sendMessage(chatId, "⛔ عذراً، هذا الأمر مخصص لمالك المنصة فقط.");
      return;
    }
    const kb = new InlineKeyboard()
      .text("📢 إعلان إجباري شامل", "admin_global_ad")
      .row()
      .text("📣 إذاعة لكل المستخدمين", "admin_broadcast")
      .row()
      .text("📊 الإحصائيات والأرباح", "admin_stats");
    await bot.api.sendMessage(chatId, "🛠 لوحة تحكم المالك الأكبر", { reply_markup: kb });
    return;
  }

  const user = await ensureUser(botRow.id, tgUserId, botRow);
  const pending = user.pendingAction as PendingAction | null;
  if (!pending) {
    await bot.api.sendMessage(chatId, "اختر من القائمة عبر /start.");
    return;
  }

  if (pending.mode === "create_ad") {
    await consumeCreateAdStep(bot, chatId, user, pending, text);
    return;
  }
  if (pending.mode === "withdraw" && pending.step === "amount") {
    await consumeWithdrawAmount(bot, chatId, user, text);
    return;
  }
  if (pending.mode === "admin_broadcast" && tgUserId === SUPER_ADMIN_ID) {
    await runBroadcast(bot, chatId, text);
    await setPending(user.id, null);
    return;
  }
  if (pending.mode === "admin_global_ad" && tgUserId === SUPER_ADMIN_ID) {
    await consumeGlobalAdStep(bot, chatId, user, pending, text);
    return;
  }
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
    await setPending(user.id, { mode: "create_ad", type, step: "review", collected: updated });
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
    const kb = new InlineKeyboard().text("🔁 إعادة تغريد", "subtype:retweet").text("➕ متابعة", "subtype:follow");
    await bot.api.sendMessage(chatId, "اختر نوع مهمة تويتر:", { reply_markup: kb });
    return;
  }
  const prompts: Record<string, string> = {
    description: "أرسل وصف حملتك (نص قصير يظهر للمستخدمين):",
    target: "أرسل الرابط/الحساب/القناة الذي تريد الترويج له:",
    budget: "حدد ميزانية حملتك بالدولار (مثال: 100):",
    cpc: `حدد السعر لكل نقرة/مهمة بالدولار (الحد الأدنى $${MIN_CPC}):`,
  };
  await bot.api.sendMessage(chatId, prompts[step]);
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
  const kb = new InlineKeyboard().text("تأكيد الإرسال ✅", "adconfirm").text("إلغاء ❌", "adcancel");
  await bot.api.sendMessage(chatId, lines.join("\n"), { reply_markup: kb });
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
  await bot.api.sendMessage(chatId, `تم إرسال طلب سحب ${fmt(amount)}. سيُراجَع من مالك المنصة.`);

  if (SUPER_ADMIN_ID) {
    const kb = new InlineKeyboard().text("✅ موافقة", `withdraw_approve_${tx.id}`).text("❌ رفض", `withdraw_reject_${tx.id}`);
    await bot.api.sendMessage(Number(SUPER_ADMIN_ID), `طلب سحب جديد\nمستخدم: ${user.id}\nالمبلغ: ${fmt(amount)}`, { reply_markup: kb }).catch(() => null);
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
  await bot.api.sendMessage(chatId, `تم الإرسال: ${sent} نجح، ${failed} فشل.`);
}

async function consumeGlobalAdStep(bot: TelegramBot, chatId: number, user: any, pending: Extract<PendingAction, { mode: "admin_global_ad" }>, text: string) {
  await prisma.ad.create({
    data: {
      userId: SUPER_ADMIN_ID,
      botId: user.botId,
      type: pending.type as any,
      content: text,
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
  await bot.api.sendMessage(chatId, "✅ تم إضافة الإعلان الإجباري. سيظهر ضمن «شاهد واربح» لكل البوتات (بلا مكافأة، ترويج مجاني للمنصة).");
}

async function handleCallback(bot: TelegramBot, botRow: BotRow, cq: any) {
  const chatId = cq.message?.chat?.id ?? cq.from.id;
  const tgUserId = String(cq.from.id);
  const data = String(cq.data || "");
  await bot.api.answerCallbackQuery(cq.id).catch(() => null);
  const user = await ensureUser(botRow.id, tgUserId, botRow);

  if (data === "back_main") {
    await bot.api.sendMessage(chatId, "القائمة الرئيسية:", { reply_markup: mainMenu() });
    return;
  }

  if (data === "watch_earn") {
    await bot.api.sendMessage(chatId, "اختر المنصة:", { reply_markup: typeKeyboard("watch") });
    return;
  }
  if (data.startsWith("watch:")) {
    const type = data.slice(6) as AdTypeStr;
    await sendWatchList(bot, chatId, tgUserId, type);
    return;
  }
  if (data.startsWith("taskdone:")) {
    const adId = data.slice(9);
    await completeTask(bot, chatId, tgUserId, adId);
    return;
  }

  if (data === "create_ad") {
    await bot.api.sendMessage(chatId, "اختر المنصة:", { reply_markup: typeKeyboard("adtype") });
    return;
  }
  if (data.startsWith("adtype:")) {
    const type = data.slice(7) as AdTypeStr;
    const steps = createAdSteps(type);
    await setPending(user.id, { mode: "create_ad", type, step: steps[0], collected: {} });
    await askCreateAdStep(bot, chatId, type, steps[0]);
    return;
  }
  if (data.startsWith("subtype:")) {
    const pending = user.pendingAction as PendingAction | null;
    if (pending?.mode === "create_ad" && pending.step === "subtype") {
      const subType = data.slice(8) as "retweet" | "follow";
      const collected = { ...pending.collected, subType };
      const next = nextCreateAdStep(pending.type, "subtype")!;
      await setPending(user.id, { mode: "create_ad", type: pending.type, step: next as any, collected });
      await askCreateAdStep(bot, chatId, pending.type, next);
    }
    return;
  }
  if (data === "adconfirm") {
    await confirmAd(bot, chatId, user);
    return;
  }
  if (data === "adcancel") {
    await setPending(user.id, null);
    await bot.api.sendMessage(chatId, "أُلغيت الحملة.");
    return;
  }

  if (data === "wallet") {
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    const kb = new InlineKeyboard().text("إيداع 💰", "deposit").text("سحب 💸", "withdraw_start");
    await bot.api.sendMessage(chatId, `رصيدك: ${fmt(Number(fresh?.balance || 0))}`, { reply_markup: kb });
    return;
  }
  if (data === "deposit") {
    await sendDepositOptions(bot, chatId, user.id);
    return;
  }
  if (data === "withdraw_start") {
    await setPending(user.id, { mode: "withdraw", step: "amount" });
    await bot.api.sendMessage(chatId, `أرسل المبلغ المراد سحبه بالدولار (الحد الأدنى $${MIN_WITHDRAWAL}):`);
    return;
  }

  if (data === "referrals") {
    const me = await bot.api.getMe();
    await bot.api.sendMessage(chatId, `رابط إحالتك:\nhttps://t.me/${me.username}?start=${user.id}`);
    return;
  }

  if (data === "stats") {
    await sendStats(bot, chatId, user.id);
    return;
  }

  // --- Super Admin only ---
  if (tgUserId !== SUPER_ADMIN_ID) return;

  if (data === "admin_broadcast") {
    await setPending(user.id, { mode: "admin_broadcast" });
    await bot.api.sendMessage(chatId, "أرسل نص الرسالة التي ستصل لكل مستخدمي المنصة:");
    return;
  }
  if (data === "admin_global_ad") {
    await bot.api.sendMessage(chatId, "اختر منصة الإعلان الإجباري:", { reply_markup: typeKeyboard("gad") });
    return;
  }
  if (data.startsWith("gad:")) {
    const type = data.slice(4) as AdTypeStr;
    await setPending(user.id, { mode: "admin_global_ad", type });
    await bot.api.sendMessage(chatId, "أرسل الرابط/الحساب الذي تريد الترويج له:");
    return;
  }
  if (data === "admin_stats") {
    const [botsCount, usersCount, revenueAgg] = await Promise.all([
      prisma.bot.count(),
      prisma.user.count(),
      prisma.bot.aggregate({ _sum: { totalRevenue: true } }),
    ]);
    await bot.api.sendMessage(
      chatId,
      `📊 إحصائيات المنصة:\nعدد البوتات: ${botsCount}\nعدد المستخدمين: ${usersCount}\nأرباح المنصة التراكمية: ${fmt(Number(revenueAgg._sum.totalRevenue || 0))}`
    );
    return;
  }
  if (data.startsWith("withdraw_approve_") || data.startsWith("withdraw_reject_")) {
    const approve = data.startsWith("withdraw_approve_");
    const txId = data.slice(approve ? 17 : 16);
    await decideWithdrawal(bot, chatId, txId, approve);
    return;
  }
}

async function sendWatchList(bot: TelegramBot, chatId: number, tgUserId: string, type: AdTypeStr) {
  const ads = await prisma.ad.findMany({
    where: { type: type as any, status: "ACTIVE", remaining: { gte: 0 }, userId: { not: tgUserId } },
    orderBy: { created_at: "desc" },
    take: 10,
  });
  const usable = ads.filter((a) => a.cpc === 0 || Number(a.remaining) >= Number(a.cpc));
  if (usable.length === 0) {
    await bot.api.sendMessage(chatId, "لا حملات متاحة على هذه المنصة حالياً.");
    return;
  }
  for (const ad of usable) {
    const isForced = Number(ad.cpc) === 0;
    const isTelegram = ad.type === "TELEGRAM";
    const openUrl = isTelegram ? `https://t.me/${ad.content.replace(/^@/, "")}` : ad.content;
    const kb = new InlineKeyboard().url(isTelegram ? "افتح القناة" : "فتح الرابط", openUrl);
    if (!isForced) kb.row().text(isTelegram ? "تحققت من الانضمام ✅" : "تأكيد الإتمام ✅", `taskdone:${ad.id}`);
    const label = isForced ? "🌟 عرض من المنصة" : `${TYPE_LABEL[type]}\nالمكافأة: ${fmt(Number(ad.workerCut))}`;
    await bot.api.sendMessage(chatId, label, { reply_markup: kb });
  }
}

async function completeTask(bot: TelegramBot, chatId: number, tgUserId: string, adId: string) {
  const ad = await prisma.ad.findUnique({ where: { id: adId } });
  if (!ad || ad.status !== "ACTIVE" || Number(ad.remaining) < Number(ad.cpc)) {
    await bot.api.sendMessage(chatId, "هذه المهمة لم تعد متاحة.");
    return;
  }
  if (ad.userId === tgUserId) {
    await bot.api.sendMessage(chatId, "لا يمكنك إتمام حملتك الخاصة.");
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
    await bot.api.sendMessage(chatId, "استفدت من هذه المهمة مسبقاً.");
    return;
  }

  const newRemaining = round2(Number(ad.remaining) - Number(ad.cpc));
  await prisma.ad.update({ where: { id: ad.id }, data: { remaining: newRemaining, status: newRemaining < Number(ad.cpc) ? "EXPIRED" : ad.status } });

  const worker = await prisma.user.upsert({ where: { id: tgUserId }, update: {}, create: { id: tgUserId, botId: ad.botId, role: "USER" } });
  const newBalance = round2(Number(worker.balance) + Number(ad.workerCut));
  await prisma.user.update({ where: { id: tgUserId }, data: { balance: newBalance } });

  await prisma.bot.update({ where: { id: ad.botId }, data: { ownerBalance: { increment: Number(ad.creatorCut) }, totalRevenue: { increment: Number(ad.ownerCut) } } });

  await bot.api.sendMessage(chatId, `أُضيف ${fmt(Number(ad.workerCut))}! رصيدك الآن: ${fmt(newBalance)}.`);
}

async function confirmAd(bot: TelegramBot, chatId: number, user: any) {
  const pending = user.pendingAction as PendingAction | null;
  if (pending?.mode !== "create_ad" || pending.step !== "review") return;
  const { type, collected } = pending;
  const budget = Number(collected.budget || 0);
  const cpc = Number(collected.cpc || 0);
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  const balance = Number(fresh?.balance || 0);
  if (budget > balance) {
    await bot.api.sendMessage(chatId, `الميزانية ${fmt(budget)} أكبر من رصيدك (${fmt(balance)}). أودع رصيداً أولاً من «المحفظة».`);
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
  await bot.api.sendMessage(chatId, `تم إطلاق حملتك (خُصم ${fmt(budget)}). ستظهر الآن في «شاهد واربح» لكل المستخدمين.`);
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
    `📊 إحصائياتك:\nحملات أنشأتها: ${adsCreated}\nإجمالي الصرف: ${fmt(Number(spent._sum.amount || 0))}\nمهام أتممتها: ${tasksCompleted}\nإجمالي أرباحك: ${fmt(Number(earned._sum.amount || 0))}`
  );
}

async function decideWithdrawal(bot: TelegramBot, chatId: number, txId: string, approve: boolean) {
  const tx = await prisma.transaction.findUnique({ where: { id: txId } });
  if (!tx || tx.status !== "PENDING") {
    await bot.api.sendMessage(chatId, "الطلب غير موجود أو عولج مسبقاً.");
    return;
  }
  if (approve) {
    await prisma.transaction.update({ where: { id: txId }, data: { status: "COMPLETED" } });
    await bot.api.sendMessage(chatId, "✅ تمت الموافقة — حوّل المبلغ يدوياً للمستخدم.");
  } else {
    const user = await prisma.user.findUnique({ where: { id: tx.userId } });
    await prisma.user.update({ where: { id: tx.userId }, data: { balance: round2(Number(user?.balance || 0) + Number(tx.amount)) } });
    await prisma.transaction.update({ where: { id: txId }, data: { status: "FAILED" } });
    await bot.api.sendMessage(chatId, "❌ رُفض الطلب وأُعيد المبلغ للمستخدم.");
  }
}

async function sendDepositOptions(bot: TelegramBot, chatId: number, userId: string) {
  const kb = new InlineKeyboard().url("أودع رصيداً →", `${(process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app").replace(/\/$/, "")}/pay?uid=${userId}`);
  await bot.api.sendMessage(chatId, "اختر مبلغ الإيداع وعملتك المفضّلة (USDT, TRX, TON, LTC, SOL...) في الصفحة:", { reply_markup: kb });
}
