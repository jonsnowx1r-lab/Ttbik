import { NextRequest, NextResponse } from "next/server";
import { Bot } from "grammy";
import { prisma } from "@/lib/prisma";

// One-off maintenance endpoint: swap a deployed bot's Telegram token (e.g.
// after regenerating it in @BotFather) and re-register the webhook under
// the new token — a plain SQL UPDATE on Bot.token alone wouldn't do this,
// since Telegram only delivers updates to whichever token last called
// setWebhook for that bot.
export async function POST(req: NextRequest) {
  try {
    const { botId, newToken } = await req.json();
    if (!newToken || typeof newToken !== "string") {
      return NextResponse.json({ success: false, error: "newToken is required" }, { status: 400 });
    }

    let targetId: string | undefined = botId;
    if (!targetId && process.env.SUPER_ADMIN_TELEGRAM_ID) {
      // Default target: the platform's own bot, owned by SUPER_ADMIN_TELEGRAM_ID
      // — distinct from any other bots deployed on the platform.
      const superAdminBot = await prisma.bot.findFirst({ where: { ownerId: process.env.SUPER_ADMIN_TELEGRAM_ID } });
      if (superAdminBot) targetId = superAdminBot.id;
    }
    if (!targetId) {
      const all = await prisma.bot.findMany({ select: { id: true } });
      if (all.length !== 1) {
        return NextResponse.json(
          { success: false, error: `botId is required (${all.length} bots exist, can't pick one automatically)` },
          { status: 400 }
        );
      }
      targetId = all[0].id;
    }

    const botRow = await prisma.bot.findUnique({ where: { id: targetId } });
    if (!botRow) {
      return NextResponse.json({ success: false, error: "bot not found" }, { status: 404 });
    }

    const newBot = new Bot(newToken);
    const info = await newBot.api.getMe(); // validates the new token actually works

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app").replace(/\/$/, "");
    const webhookUrl = `${siteUrl}/api/telegram/${botRow.id}`;
    await newBot.api.setWebhook(webhookUrl, { secret_token: botRow.webhookSecret });

    await prisma.bot.update({ where: { id: botRow.id }, data: { token: newToken } });

    return NextResponse.json({ success: true, message: `Token updated for @${info.username}`, botId: botRow.id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "update failed" }, { status: 400 });
  }
}
