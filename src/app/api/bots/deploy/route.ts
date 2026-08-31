import { NextRequest, NextResponse } from "next/server";
import { Bot } from "grammy";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { token, template, ownerId, ref, activationCode } = await req.json();

    // Gate on a paid, admin-approved activation code (owner spec,
    // 2026-08-31) — /bots was previously open to anyone with a token and an
    // ID, letting every bot user turn themselves into a "creator" for
    // free. The code is minted only once السوبر أدمن approves a $100
    // bank-transfer request (see decideBotPurchase in adBotLogic.ts) and is
    // tied to that specific buyer's Telegram ID, so it can't be reused for
    // someone else's ownerId or for a second bot. The platform owner
    // themself is exempt — they approve their own codes anyway.
    const isSuperAdmin = process.env.SUPER_ADMIN_TELEGRAM_ID && String(ownerId) === process.env.SUPER_ADMIN_TELEGRAM_ID;
    let purchase: { id: string } | null = null;
    if (!isSuperAdmin) {
      const code = String(activationCode || "").trim().toUpperCase();
      if (!code) {
        return NextResponse.json({ success: false, error: "كود التفعيل مطلوب. اطلبه من داخل أي بوت على المنصة عبر زر «أريد بوتاً مماثلاً»." }, { status: 400 });
      }
      const found = await prisma.botPurchase.findUnique({ where: { code } });
      if (!found || found.status !== "APPROVED" || found.buyerId !== String(ownerId)) {
        return NextResponse.json({ success: false, error: "كود التفعيل غير صالح أو غير مطابق لآيدي المالك المُدخل." }, { status: 400 });
      }
      purchase = found;
    }

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

    if (purchase) {
      await prisma.botPurchase.update({ where: { id: purchase.id }, data: { status: "REDEEMED" } });
    }

    return NextResponse.json({
      success: true,
      message: `Bot @${botInfo.username} activated successfully!`,
      botId: newBot.id,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Deployment failed" }, { status: 400 });
  }
}
