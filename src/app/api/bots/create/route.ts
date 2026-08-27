import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getBotTemplate } from "@/lib/botTemplates";
import { randomPublicCode, randomSecret, siteBase } from "@/lib/botCodes";
import { tgGetMe, tgSetWebhook } from "@/lib/tgApi";
import { isOwnerRequest } from "@/lib/isOwner";

/** Accept only orders tied to a bot-hosting service (slug/name contains bot/بوت). */
function isBotService(svc: { slug?: string | null; name_ar?: string | null; tool_route?: string | null } | null) {
  if (!svc) return false;
  const slug = (svc.slug || "").toLowerCase();
  const name = (svc.name_ar || "").toLowerCase();
  const route = (svc.tool_route || "").toLowerCase();
  return (
    slug.includes("bot") ||
    name.includes("بوت") ||
    route.includes("bot") ||
    slug.startsWith("ad-") ||
    slug.includes("campaign") ||
    slug.includes("store") ||
    slug.includes("clinic")
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  const template = getBotTemplate(String(body.template || ""));
  if (!template) return NextResponse.json({ error: "القالب غير معروف" }, { status: 400 });

  const token = String(body.token || "").trim();
  const ownerContact = String(body.ownerContact || "").trim();
  const orderCode = String(body.orderCode || "").trim();
  const welcome = String(body.welcome || template.defaults.welcome).trim();
  const isOwner = isOwnerRequest(req);

  if (!token || !token.includes(":")) {
    return NextResponse.json({ error: "الصق توكن البوت من BotFather" }, { status: 400 });
  }
  if (!ownerContact) {
    return NextResponse.json({ error: "أدخل وسيلة تواصل للمالك" }, { status: 400 });
  }

  let paidOrderId: string | null = null;
  if (!isOwner) {
    if (!orderCode) {
      return NextResponse.json({ error: "أدخل رمز طلب معتمد من صفحة الطلب أولاً" }, { status: 402 });
    }
    const { data: order } = await supabaseAdmin()
      .from("orders")
      .select("id,order_code,status, services(slug, name_ar, tool_route)")
      .eq("order_code", orderCode)
      .maybeSingle();
    if (!order || order.status !== "approved") {
      return NextResponse.json({ error: "الطلب غير موجود أو لم يُعتمد بعد. الإنشاء بعد الدفع والموافقة فقط." }, { status: 402 });
    }
    const svc = Array.isArray(order.services) ? order.services[0] : order.services;
    if (!isBotService(svc)) {
      return NextResponse.json(
        { error: "هذا الطلب ليس لخدمة إنشاء بوت. استخدم رمز طلب معتمد لخدمة البوتات فقط." },
        { status: 402 }
      );
    }
    paidOrderId = order.id;
  }

  const me = await tgGetMe(token);
  if (!me.ok || !me.result) {
    return NextResponse.json({ error: "التوكن غير صالح أو بوت محظور" }, { status: 400 });
  }

  const publicCode = randomPublicCode("B");
  const webhookSecret = randomSecret();
  const status = isOwner || paidOrderId ? "live" : "pending";
  const config = {
    faq: String(body.faq || template.defaults.faq),
    currencyName: String(body.currencyName || template.defaults.currencyName),
    products: String(body.products || "").split("\n").map((s: string) => s.trim()).filter(Boolean).slice(0, 12),
    botUsername: me.result.username || "",
    orderCode: orderCode || null,
    noWithdraw: true,
  };

  const row = {
    public_code: publicCode,
    template_type: template.id,
    bot_token: token,
    bot_username: me.result.username ? `@${me.result.username}` : null,
    bot_tg_id: String(me.result.id),
    owner_contact: ownerContact,
    welcome_text: welcome,
    config,
    status,
    webhook_secret: webhookSecret,
  };

  const { data, error } = await supabaseAdmin().from("hosted_bots").insert(row).select("id,public_code,status,bot_username").single();
  if (error) {
    return NextResponse.json({
      error: "تعذر الحفظ في القاعدة. شغّل supabase/pending_migration.sql ثم أعد.",
      detail: error.message,
    }, { status: 500 });
  }

  if (status === "live") {
    const hook = await tgSetWebhook(token, `${siteBase()}/api/bots/hook/${data.id}`, webhookSecret);
    if (!hook.ok) {
      await supabaseAdmin().from("hosted_bots").update({ status: "pending" }).eq("id", data.id);
      return NextResponse.json({ ok: true, warning: "حُفظ البوت لكن الويب هوك فشل.", bot: data });
    }
  }

  return NextResponse.json({
    ok: true,
    bot: data,
    message: status === "live" ? "البوت يعمل. أرسل /start" : "في انتظار التفعيل",
  });
}
