import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// NOWPayments IPN: HMAC-SHA512 of the JSON body with keys sorted
// alphabetically and no extra whitespace (their documented signing scheme),
// compared against the x-nowpayments-sig header.
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
    return NextResponse.json({ ok: true }); // still pending — nothing to credit yet
  }

  const userId = String(body.order_id || "");
  const amount = Number(body.price_amount || 0);
  const externalId = String(body.payment_id || body.invoice_id || userId);
  if (!userId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "bad order_id" }, { status: 400 });
  }

  try {
    // Idempotency: txHash has a unique constraint, so a duplicate IPN retry
    // fails this insert and we skip crediting twice.
    await prisma.transaction.create({
      data: { userId, amount, currency: "crypto", type: "DEPOSIT", status: "COMPLETED", txHash: externalId },
    });
  } catch {
    return NextResponse.json({ ok: true }); // already credited
  }

  await prisma.user.upsert({
    where: { id: userId },
    update: { balance: { increment: amount } },
    create: { id: userId, botId: "", role: "USER", balance: amount },
  });

  return NextResponse.json({ ok: true });
}
