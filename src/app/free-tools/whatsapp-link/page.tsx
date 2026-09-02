import type { Metadata } from "next";
import WhatsappLinkGenerator from "./WhatsappLinkGenerator";
import AdSlot from "@/components/AdSlot";

export const metadata: Metadata = {
  title: "مولد رابط الطلب عبر واتساب مجاناً | سوق تولز",
  description: "أنشئ رابط طلب واتساب جاهز لمنتجك خلال ثوانٍ، مجاناً وبلا حدود استخدام. لا تحتاج تسجيل أو دفع.",
};

export default function WhatsappLinkPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        🎁 أداة مجانية بالكامل
      </span>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900">مولد رابط الطلب عبر واتساب</h1>
      <p className="mt-2 text-slate-600">
        أدخل بيانات منتجك مرة واحدة، واحصل على رابط جاهز يفتح محادثة واتساب مع رسالة طلب معبّأة تلقائياً —
        شاركه في حالتك أو منشوراتك ودع عملاءك يطلبون بضغطة واحدة.
      </p>
      <div className="mt-6">
        <WhatsappLinkGenerator />
      </div>
      <div className="mt-8">
        <AdSlot position="in-content" label="أسفل مولد رابط واتساب" />
      </div>
    </div>
  );
}
