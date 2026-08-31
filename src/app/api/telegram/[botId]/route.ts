import { NextRequest, NextResponse } from "next/server";
import { Bot as TelegramBot } from "grammy";
import { prisma } from "@/lib/prisma";
import { handleAdBotUpdate } from "@/lib/adBotLogic";

export async function POST(req: NextRequest, { params }: { params: { botId: string } }) {
  try {
    const secret = req.headers.get("x-telegram-bot-api-secret-token") || "";
    const botRow = await prisma.bot.findUnique({ where: { id: params.botId } });

    if (!botRow || !botRow.isActive) {
      return NextResponse.json({ error: "Bot inactive or missing" }, { status: 404 });
    }
    if (secret !== botRow.webhookSecret) {
      return NextResponse.json({ error: "invalid secret" }, { status: 401 });
    }

    const bot = new TelegramBot(botRow.token);
    const body = await req.json().catch(() => null);
    if (body) {
      if (botRow.template === "AD_BOT") {
        await handleAdBotUpdate(bot, botRow, body);
      } else {
        // STORE / HOSPITAL: the owner's blueprint only ever specified AD_BOT
        // logic in detail — these templates get a minimal working /start so
        // picking them doesn't error, without inventing flows that weren't
        // actually given.
        const msg = body.message;
        if (msg?.text?.startsWith("/start") && msg.chat?.id) {
          const label = botRow.template === "STORE" ? "🛒 بوت المتجر" : "🏥 بوت المشفى";
          await bot.api.sendMessage(msg.chat.id, `${label} قيد الإعداد من مالك المنصة. تواصل مع منشئ البوت للمزيد.`);
        }
      }
    }
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
