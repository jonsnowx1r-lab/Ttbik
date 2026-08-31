import { NextRequest, NextResponse } from "next/server";
import { Bot as TelegramBot } from "grammy";
import { prisma } from "@/lib/prisma";

// Standalone verify+payout endpoint, exactly as specified in the blueprint
// (for callers outside the Telegram webhook itself, e.g. a website widget).
// The bot's own /taskdone: callback_query handler in adBotLogic.ts calls the
// same Prisma logic directly rather than round-tripping through HTTP.
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

    try {
      await prisma.transaction.create({
        data: { userId: String(userId), amount: Number(ad.workerCut), currency: "internal", type: "TASK_REWARD", status: "COMPLETED", txHash: `task_${adId}_${userId}` },
      });
    } catch {
      return NextResponse.json({ success: false, message: "استفدت من هذه المهمة مسبقاً." });
    }

    const newRemaining = Math.round((Number(ad.remaining) - Number(ad.cpc)) * 100) / 100;
    await prisma.ad.update({ where: { id: adId }, data: { remaining: newRemaining, status: newRemaining < Number(ad.cpc) ? "EXPIRED" : ad.status } });
    await prisma.user.upsert({
      where: { id: String(userId) },
      update: { balance: { increment: Number(ad.workerCut) } },
      create: { id: String(userId), botId: ad.botId, role: "USER", balance: Number(ad.workerCut) },
    });
    await prisma.bot.update({ where: { id: ad.botId }, data: { ownerBalance: { increment: Number(ad.creatorCut) }, totalRevenue: { increment: Number(ad.ownerCut) } } });

    return NextResponse.json({ success: true, message: `تم التحقق بنجاح! تم إضافة ${ad.workerCut} إلى محفظتك.` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
