import { NextRequest, NextResponse } from "next/server";
import { verifyNowPaymentsSignature } from "@/lib/nowpaymentsSignature";
import { decideOrder } from "@/lib/orders";

// NOWPayments IPN for the /service catalog checkout (see
// api/orders/create-invoice). order_id is the orders.id we generated
// ourselves at invoice-creation time, so a confirmed payment maps straight
// back to one row — decideOrder() is already idempotent (no-ops once an
// order is no longer "pending"), so a retried IPN can't double-approve.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-nowpayments-sig") || "";
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  if (!verifyNowPaymentsSignature(body, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const status = String(body.payment_status || "");
  if (status !== "finished" && status !== "confirmed") {
    return NextResponse.json({ ok: true }); // still pending — nothing to do yet
  }

  const orderId = String(body.order_id || "");
  if (!orderId) return NextResponse.json({ error: "missing order_id" }, { status: 400 });

  try {
    // No third arg on purpose: decideOrder's `note` param doubles as an
    // override for the delivered content itself (used when an admin types
    // a custom reply in the manual-approval flow) — passing status text
    // here would replace the customer's real delivery link with it.
    await decideOrder(orderId, "approved");
  } catch {
    // order not found or already resolved — nothing more to do
  }

  return NextResponse.json({ ok: true });
}
