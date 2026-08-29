import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tgSend } from "@/lib/tgApi";

/**
 * Sends one message to every member of a hosted bot. Real bot owners always
 * want to notify their whole audience about a new ad/product/appointment —
 * this was previously impossible (no way to reach members outside a live chat).
 * Sequential with a small delay to stay under Telegram's ~30 msg/sec limit;
 * a per-user failure (e.g. user blocked the bot) doesn't stop the batch.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  if (!message) return NextResponse.json({ error: "اكتب نص الرسالة" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: bot } = await db.from("hosted_bots").select("bot_token").eq("id", params.id).maybeSingle();
  if (!bot) return NextResponse.json({ error: "البوت غير موجود" }, { status: 404 });

  const { data: members } = await db
    .from("bot_members")
    .select("tg_user_id")
    .eq("bot_id", params.id)
    .limit(500);

  let sent = 0;
  let failed = 0;
  for (const m of members || []) {
    const res = await tgSend(bot.bot_token, m.tg_user_id, message);
    if (res.ok) sent++;
    else failed++;
    await new Promise((r) => setTimeout(r, 40));
  }

  return NextResponse.json({ ok: true, sent, failed, total: (members || []).length });
}
