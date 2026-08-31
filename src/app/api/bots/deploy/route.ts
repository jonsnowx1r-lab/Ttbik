import { NextRequest, NextResponse } from "next/server";
import { Bot } from "grammy";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { token, template, ownerId } = await req.json();

    const tempBot = new Bot(token);
    const botInfo = await tempBot.api.getMe();

    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const newBot = await prisma.bot.create({
      data: {
        token,
        template: template || "AD_BOT",
        ownerId: String(ownerId),
        webhookSecret,
      },
    });

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app").replace(/\/$/, "");
    const webhookUrl = `${siteUrl}/api/telegram/${newBot.id}`;
    await tempBot.api.setWebhook(webhookUrl, { secret_token: webhookSecret });

    return NextResponse.json({
      success: true,
      message: `Bot @${botInfo.username} activated successfully!`,
      botId: newBot.id,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Deployment failed" }, { status: 400 });
  }
}
