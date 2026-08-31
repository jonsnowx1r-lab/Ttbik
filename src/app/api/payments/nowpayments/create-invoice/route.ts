import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { siteBase } from "@/lib/botCodes";
import { createInvoice, isNowPaymentsConfigured } from "@/lib/nowpayments";

export async function POST(req: NextRequest) {
  if (!isNowPaymentsConfigured()) {
    return NextResponse.json({ error: "الدفع التلقائي بعملة رقمية غير مُفعَّل بعد. استخدم نموذج التحويل اليدوي." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const publicCode = String(body.publicCode || "").trim();
  const uid = String(body.uid || "").trim();
  const amount = Math.max(1, Math.min(100000, Number(body.amount) || 0));
  if (!publicCode || !uid || !amount) {
    return NextResponse.json({ error: "أكمل الرصيد ومعرف العضو" }, { status: 400 });
  }
  const { data: bot } = await supabaseAdmin().from("hosted_bots").select("id, public_code").eq("public_code", publicCode).maybeSingle();
  if (!bot) return NextResponse.json({ error: "البوت غير موجود" }, { status: 404 });

  // order_id round-trips bot_id + tg_user_id through NOWPayments so the IPN
  // webhook knows whose balance to credit without needing its own session.
  const orderId = `${bot.id}:${uid}:${Date.now()}`;
  const base = siteBase();
  const result = await createInvoice({
    priceAmount: amount,
    orderId,
    orderDescription: `Ttbik bot ${bot.public_code} deposit`,
    ipnCallbackUrl: `${base}/api/payments/nowpayments/webhook`,
    successUrl: `${base}/pay/bot/${bot.public_code}?uid=${uid}&paid=1`,
    cancelUrl: `${base}/pay/bot/${bot.public_code}?uid=${uid}`,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ invoiceUrl: result.invoiceUrl });
}
