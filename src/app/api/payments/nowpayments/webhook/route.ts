import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

// NOWPayments IPN: HMAC-SHA512 of the JSON body with keys sorted
// alphabetically (their documented signing scheme, not ours to choose) and
// no extra whitespace, compared against the x-nowpayments-sig header.
function sortedJson(obj: any): string {
  if (Array.isArray(obj)) return `[${obj.map(sortedJson).join(",")}]`;
  if (obj && typeof obj === "object") {
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${sortedJson(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(obj);
}

export async function POST(req: NextRequest) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET || "";
  const signature = req.headers.get("x-nowpayments-sig") || "";
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const expected = crypto.createHmac("sha512", secret).update(sortedJson(body)).digest("hex");
  if (signature !== expected) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const status = String(body.payment_status || "");
  if (status !== "finished" && status !== "confirmed") {
    return NextResponse.json({ ok: true }); // still pending/partially paid — nothing to credit yet
  }

  const orderId = String(body.order_id || "");
  const [botId, tgUserId] = orderId.split(":");
  const amount = Number(body.price_amount || 0);
  const externalId = String(body.payment_id || body.invoice_id || orderId);
  if (!botId || !tgUserId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "bad order_id" }, { status: 400 });
  }

  const db = supabaseAdmin();
  // Idempotency: external_id has a unique index, so a duplicate IPN retry
  // fails this insert and we skip crediting twice.
  const { error: insertError } = await db
    .from("bot_wallet_tx")
    .insert({ bot_id: botId, tg_user_id: tgUserId, kind: "deposit", amount, status: "completed", payment_method: "crypto", note: "NOWPayments", external_id: externalId });
  if (insertError) return NextResponse.json({ ok: true }); // already credited

  const { data: member } = await db.from("bot_members").select("points").eq("bot_id", botId).eq("tg_user_id", tgUserId).maybeSingle();
  const newPoints = Math.round((Number(member?.points || 0) + amount) * 100) / 100;
  // upsert (not update): the member row should already exist — they got this
  // deposit link from inside the bot — but real money is on the line here,
  // so this must not silently no-op if it's somehow missing.
  await db.from("bot_members").upsert({ bot_id: botId, tg_user_id: tgUserId, points: newPoints }, { onConflict: "bot_id,tg_user_id" });

  return NextResponse.json({ ok: true });
}
