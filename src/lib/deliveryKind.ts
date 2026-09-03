import type { Service } from "@/types";

/**
 * Every product is either permanent unlimited access to a hosted tool we
 * run (the Groq-powered AI tools), or a fully-built, ready-to-run product
 * delivered to the customer to own (bots, automation, landing pages).
 * Surfacing this distinction clearly avoids customers wondering "did I
 * just buy a file, or a subscription?" — it's always a one-time payment,
 * but the *shape* of what they get differs. Never frame the second kind
 * as "source code for sale" — this is a real working product/service we
 * build and deliver, not text/code being sold (owner directive).
 */
export function getDeliveryKind(service: Pick<Service, "tool_route">) {
  if (service.tool_route) {
    return {
      label: "🔑 وصول كامل دائم",
      detail: "دفعة واحدة فقط، بدون أي اشتراك شهري — رابط الأداة يبقى ملكك للاستخدام غير المحدود.",
    };
  }
  return {
    label: "🚀 منتج جاهز تملكه بالكامل",
    detail: "تستلم نسخة كاملة جاهزة للتشغيل فوراً باسمك، تديرها وتعدّلها كما تشاء، بلا أي قيود أو اشتراك متكرر.",
  };
}
