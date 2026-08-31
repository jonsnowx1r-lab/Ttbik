// Real multi-chain crypto deposits (owner decision 2026-08-31, after
// weighing the security/legal responsibility of custodial crypto and
// choosing to proceed). Uses NOWPayments' hosted Invoice page instead of
// generating raw per-chain addresses ourselves — the user picks their chain
// (USDT-TRC20/BEP20/TON, TRX, TON, LTC, SOL, ...) on NOWPayments' own
// checkout, and their IPN webhook tells us when it's actually paid. This
// keeps private-key custody entirely on NOWPayments' side; we never touch
// a wallet key.
//
// Requires NOWPAYMENTS_API_KEY (and NOWPAYMENTS_IPN_SECRET for the webhook
// signature) as real environment variables from the owner's own NOWPayments
// account — deliberately not built without them; every caller must check
// isNowPaymentsConfigured() first and fall back to the manual bank/USDT
// deposit form when it's false.

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
  if (!apiKey) return { ok: false, error: "NOWPayments غير مُفعَّل (لا يوجد NOWPAYMENTS_API_KEY)." };

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
