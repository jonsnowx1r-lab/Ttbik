import type { Service } from "@/types";

/**
 * Every product is either a piece of code the customer downloads and owns
 * forever (templates: bots, automation, landing pages), or permanent
 * unlimited access to a hosted tool we run (the Groq-powered AI tools).
 * Surfacing this distinction clearly avoids customers wondering "did I just
 * buy a file, or a subscription?" — it's always a one-time payment, but the
 * *shape* of what they get differs.
 */
export function getDeliveryKind(service: Pick<Service, "tool_route">) {
  if (service.tool_route) {
    return {
      label: "🔑 وصول كامل دائم",
      detail: "دفعة واحدة فقط، بدون أي اشتراك شهري — رابط الأداة يبقى ملكك للاستخدام غير المحدود.",
    };
  }
  return {
    label: "📦 كود جاهز تملكه بالكامل",
    detail: "تحصل على الكود المصدري كاملاً لتنزيله واستضافته وتعديله كيفما تشاء، بلا أي قيود.",
  };
}
