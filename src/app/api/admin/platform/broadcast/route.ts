import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tgSend } from "@/lib/tgApi";

// Sends one message to every member of every hosted bot (owner decision
// 2026-08-31: Super Admin cross-bot broadcast). Best-effort — one member's
// send failure (e.g. they blocked the bot) never stops the rest, so the
// response always reports how many actually went out.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  if (!text) return NextResponse.json({ error: "الرسالة فارغة" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: bots } = await db.from("hosted_bots").select("id, bot_token").eq("status", "live");
  if (!bots || bots.length === 0) return NextResponse.json({ sent: 0, failed: 0 });

  let sent = 0;
  let failed = 0;
  for (const bot of bots) {
    const { data: members } = await db.from("bot_members").select("tg_user_id").eq("bot_id", bot.id);
    for (const m of members || []) {
      try {
        await tgSend(bot.bot_token, Number(m.tg_user_id), text);
        sent++;
      } catch {
        failed++;
      }
    }
  }
  return NextResponse.json({ sent, failed });
}
