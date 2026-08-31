import { NextRequest, NextResponse } from "next/server";
import { Bot as TelegramBot } from "grammy";
import { prisma } from "@/lib/prisma";

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || "";

// Standalone verify+payout endpoint, exactly as specified in the blueprint
// (for callers outside the Telegram webhook itself, e.g. a website widget).
// The bot's own per-task confirm handler in adBotLogic.ts calls the same
// Prisma logic directly rather than round-tripping through HTTP.
export async function POST(req: NextRequest) {
  try {
    const { userId, adId, botToken } = await req.json();

    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad || ad.status !== "ACTIVE" || Number(ad.remaining) < Number(ad.cpc)) {
      return NextResponse.json({ success: false, message: "الإعلان غير نشط أو انتهت ميزانيته." });
    }
    if (ad.userId === String(userId)) {
      return NextResponse.json({ success: false, message: "لا يمكنك إتمام حملتك الخاصة." });
    }

    if (ad.type === "TELEGRAM") {
      const bot = new TelegramBot(botToken);
      const member = await bot.api.getChatMember(ad.content, Number(userId));
      const isValidStatus = ["creator", "administrator", "member"].includes(member.status);
      if (!isValidStatus) {
        return NextResponse.json({ success: false, message: "لم تقم بالانضمام للقناة بعد!" });
      }
    }

    // Ensure the FK targets of the atomic batch below exist first — these
    // upserts are idempotent no-ops when the row already exists; only the
    // actual balance mutations need to be atomic together.
    await prisma.user.upsert({ where: { id: String(userId) }, update: {}, create: { id: String(userId), botId: ad.botId, role: "USER" } });
    if (SUPER_ADMIN_ID) {
      await prisma.user.upsert({ where: { id: SUPER_ADMIN_ID }, update: {}, create: { id: SUPER_ADMIN_ID, botId: ad.botId, role: "SUPER_ADMIN" } });
    }

    const newRemaining = Math.round((Number(ad.remaining) - Number(ad.cpc)) * 100) / 100;
    const workerCut = Number(ad.workerCut);
    const creatorCut = Number(ad.creatorCut);
    const ownerCut = Number(ad.ownerCut);

    // Atomic — the dedup guard (unique txHash) is the first operation, so a
    // double-claim rolls back every other write in this batch too.
    try {
      await prisma.$transaction([
        prisma.transaction.create({
          data: { userId: String(userId), amount: workerCut, currency: "internal", type: "TASK_REWARD", status: "COMPLETED", txHash: `task_${adId}_${userId}` },
        }),
        prisma.ad.update({ where: { id: adId }, data: { remaining: newRemaining, status: newRemaining < Number(ad.cpc) ? "EXPIRED" : ad.status } }),
        prisma.user.update({ where: { id: String(userId) }, data: { balance: { increment: workerCut } } }),
        prisma.bot.update({ where: { id: ad.botId }, data: { ownerBalance: { increment: creatorCut }, totalRevenue: { increment: ownerCut } } }),
        ...(SUPER_ADMIN_ID
          ? [prisma.transaction.create({ data: { userId: SUPER_ADMIN_ID, amount: ownerCut, currency: "internal", type: "PLATFORM_PROFIT", status: "COMPLETED" } })]
          : []),
      ]);
    } catch {
      return NextResponse.json({ success: false, message: "استفدت من هذه المهمة مسبقاً." });
    }

    return NextResponse.json({ success: true, message: `تم التحقق بنجاح! تم إضافة ${workerCut} إلى محفظتك.` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
