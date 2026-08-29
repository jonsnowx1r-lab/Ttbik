import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { siteBase } from "@/lib/botCodes";
import { tgDeleteWebhook, tgSetWebhook } from "@/lib/tgApi";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const db = supabaseAdmin();
  const { data: bot } = await db.from("hosted_bots").select("*").eq("id", params.id).maybeSingle();
  if (!bot) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  if (action === "live") {
    const hook = await tgSetWebhook(bot.bot_token, `${siteBase()}/api/bots/hook/${bot.id}`, bot.webhook_secret);
    if (!hook.ok) return NextResponse.json({ error: hook.description || "فشل الويب هوك" }, { status: 400 });
    await db.from("hosted_bots").update({ status: "live" }).eq("id", bot.id);
    return NextResponse.json({ ok: true, status: "live" });
  }
  if (action === "pause") {
    await tgDeleteWebhook(bot.bot_token).catch(() => null);
    await db.from("hosted_bots").update({ status: "paused" }).eq("id", bot.id);
    return NextResponse.json({ ok: true, status: "paused" });
  }
  if (action === "set_merchant") {
    const merchantTgId = String(body.merchantTgId || "").trim();
    const config = { ...(bot.config || {}), merchant_tg_id: merchantTgId || null };
    await db.from("hosted_bots").update({ config }).eq("id", bot.id);
    return NextResponse.json({ ok: true, merchant_tg_id: merchantTgId || null });
  }
  return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
}
