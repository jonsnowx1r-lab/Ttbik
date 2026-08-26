import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateOrderCode } from "@/lib/utils";
import { sendOrderAlert } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { serviceId, customerName, customerContact, paymentMethod, transferReference } = body ?? {};

  if (!serviceId || !customerName || !customerContact || !paymentMethod || !transferReference) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  if (!["bank", "usdt"].includes(paymentMethod)) {
    return NextResponse.json({ error: "طريقة دفع غير صالحة" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: service, error: serviceError } = await db
    .from("services")
    .select("id, name_ar, price_usd, is_active")
    .eq("id", serviceId)
    .single();

  if (serviceError || !service || !service.is_active) {
    return NextResponse.json({ error: "الخدمة غير متوفرة" }, { status: 404 });
  }

  const { data: customer } = await db
    .from("customers")
    .insert({ name: customerName, contact: customerContact })
    .select()
    .single();

  const orderCode = generateOrderCode();

  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      order_code: orderCode,
      service_id: service.id,
      customer_id: customer?.id ?? null,
      customer_name: customerName,
      customer_contact: customerContact,
      payment_method: paymentMethod,
      transfer_reference: transferReference,
      amount_usd: service.price_usd,
      status: "pending",
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "تعذّر إنشاء الطلب" }, { status: 500 });
  }

  await db.from("notifications").insert({
    order_id: order.id,
    channel: "site",
    message: `طلب جديد ${order.order_code} بانتظار المراجعة.`,
  });

  const tg = await sendOrderAlert({
    orderId: order.id,
    orderCode: order.order_code,
    serviceName: service.name_ar,
    priceUsd: service.price_usd,
    customerName,
    customerContact,
    paymentMethod,
    transferReference,
  });

  if (tg.message_id && tg.chat_id) {
    await db
      .from("orders")
      .update({ telegram_message_id: tg.message_id, telegram_chat_id: tg.chat_id })
      .eq("id", order.id);
  }

  return NextResponse.json({ orderCode: order.order_code });
}
