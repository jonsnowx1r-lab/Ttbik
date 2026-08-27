import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handleBotUpdate } from "@/lib/botEngine";

export async function POST(req: NextRequest, { params }: { params: { botId: string } }) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  const { data: bot } = await supabaseAdmin()
    .from("hosted_bots")
    .select("id,public_code,template_type,bot_token,welcome_text,config,status,webhook_secret")
    .eq("id", params.botId)
    .maybeSingle();

  if (!bot || !bot.bot_token) return NextResponse.json({ ok: true });
  if (!bot.webhook_secret || !secret || secret !== bot.webhook_secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  if (update) {
    try {
      await handleBotUpdate(bot, update);
    } catch {
      // keep Telegram from retry-storming on handler bugs
    }
  }
  return NextResponse.json({ ok: true });
}
