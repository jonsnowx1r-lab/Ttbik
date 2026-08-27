import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getBotTemplate } from "@/lib/botTemplates";
import { randomPublicCode, randomSecret, siteBase } from "@/lib/botCodes";
import { tgGetMe, tgSetWebhook } from "@/lib/tgApi";
import { isOwnerRequest } from "@/lib/isOwner";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  const template = getBotTemplate(String(body.template || ""));
  if (!template) return NextResponse.json({ error: "القالب غير معروف" }, { status: 400 });

  const token = String(body.token || "").trim();
  const ownerContact = String(body.ownerContact || "").trim();
  const welcome = String(body.welcome || template.defaults.welcome).trim();
  const config = {
    faq: String(body.faq || template.defaults.faq),
    currencyName: String(body.currencyName || template.defaults.currencyName),
    contest: String(body.contest || template.defaults.extra.contest || ""),
    support: String(body.support || ""),
    hours: String(body.hours || template.defaults.extra.hours || ""),
    products: String(body.products || "").split("\n").map((s: string) => s.trim()).filter(Boolean).slice(0, 12),
  };

  if (!token || !token.includes(":")) {
    return NextResponse.json({ error: "الصق توكن البوت من BotFather" }, { status: 400 });
  }
  if (!ownerContact) {
    return NextResponse.json({ error: "أدخل وسيلة تواصل للمالك" }, { status: 400 });
  }

  const me = await tgGetMe(token);
  if (!me.ok || !me.result) {
    return NextResponse.json({ error: "التوكن غير صالح أو بوت محظور" }, { status: 400 });
  }

  const isOwner = isOwnerRequest(req);
  const publicCode = randomPublicCode("B");
  const webhookSecret = randomSecret();
  const status = isOwner ? "live" : "pending";

  const row = {
    public_code: publicCode,
    template_type: template.id,
    bot_token: token,
    bot_username: me.result.username ? `@${me.result.username}` : null,
    bot_tg_id: String(me.result.id),
    owner_contact: ownerContact,
    welcome_text: welcome,
    config: { ...config, botUsername: me.result.username || "" },
    status,
    webhook_secret: webhookSecret,
  };

  const { data, error } = await supabaseAdmin().from("hosted_bots").insert(row).select("id,public_code,status,bot_username").single();
  if (error) {
    return NextResponse.json({
      error: "تعذر الحفظ في القاعدة. شغّل ملف supabase/pending_migration.sql ثم أعد المحاولة.",
      detail: error.message,
    }, { status: 500 });
  }

  if (status === "live") {
    const hookUrl = `${siteBase()}/api/bots/hook/${data.id}`;
    const hook = await tgSetWebhook(token, hookUrl, webhookSecret);
    if (!hook.ok) {
      await supabaseAdmin().from("hosted_bots").update({ status: "pending" }).eq("id", data.id);
      return NextResponse.json({
        ok: true,
        warning: "البوت حُفظ لكن تفعيل الويب هوك فشل.",
        bot: data,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    bot: data,
    message: status === "live" ? "البوت يعمل الآن. أرسل /start" : "تم الحفظ بانتظار تفعيل المالك",
  });
}
