import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const publicCode = String(body.publicCode || "").trim();
  const uid = String(body.uid || "").trim();
  const kind = body.kind === "withdraw" ? "withdraw" : "deposit";
  const amount = Math.max(1, Math.min(100000, Number(body.amount) || 0));
  const reference = String(body.reference || "").trim();
  const method = body.method === "usdt" ? "usdt" : "bank";
  if (!publicCode || !uid || !amount || !reference) {
    return NextResponse.json({ error: "أكمل الرصيد والمرجع ومعرف العضو" }, { status: 400 });
  }
  const { data: bot } = await supabaseAdmin().from("hosted_bots").select("id").eq("public_code", publicCode).maybeSingle();
  if (!bot) return NextResponse.json({ error: "البوت غير موجود" }, { status: 404 });
  const { error } = await supabaseAdmin().from("bot_wallet_tx").insert({
    bot_id: bot.id,
    tg_user_id: uid,
    kind,
    amount,
    status: "pending",
    payment_method: method,
    note: reference,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
