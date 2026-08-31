// Real multi-chain crypto deposits via NOWPayments' hosted Invoice page —
// the user picks their chain (USDT-TRC20/BEP20/TON, TRX, TON, LTC, SOL...)
// on NOWPayments' own checkout; we never generate or touch a private key.

const NOWPAYMENTS_API = "https://api.nowpayments.io/v1";

export function isNowPaymentsConfigured(): boolean {
  return !!process.env.NOWPAYMENTS_API_KEY;
}

export async function createInvoice(params: {
  priceAmount: number;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ ok: boolean; invoiceUrl?: string; error?: string }> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) return { ok: false, error: "NOWPayments غير مُفعَّل." };

  const res = await fetch(`${NOWPAYMENTS_API}/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      price_amount: params.priceAmount,
      price_currency: "usd",
      order_id: params.orderId,
      order_description: params.orderDescription,
      ipn_callback_url: params.ipnCallbackUrl,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.invoice_url) {
    return { ok: false, error: data?.message || data?.code || "تعذّر إنشاء فاتورة الدفع" };
  }
  return { ok: true, invoiceUrl: data.invoice_url };
}
