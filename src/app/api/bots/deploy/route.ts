import { NextRequest, NextResponse } from "next/server";
import { Bot } from "grammy";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { token, template, ownerId, ref } = await req.json();

    const tempBot = new Bot(token);
    const botInfo = await tempBot.api.getMe();

    // B2B bot-creator referral (owner spec, 2026-08-31): whoever's referral
    // link this bot was activated through gets an ongoing 5% cut of the
    // platform's net profit from this bot's activity — see payoutTask in
    // adBotLogic.ts. Self-referral is meaningless, so it's dropped here.
    const referredByOwnerId = ref && String(ref).trim() && String(ref).trim() !== String(ownerId) ? String(ref).trim() : null;

    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const newBot = await prisma.bot.create({
      data: {
        token,
        template: template || "AD_BOT",
        ownerId: String(ownerId),
        webhookSecret,
        referredByOwnerId,
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
