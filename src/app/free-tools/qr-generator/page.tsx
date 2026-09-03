import type { Metadata } from "next";
import QrGenerator from "./QrGenerator";
import AdSlot from "@/components/AdSlot";

export const metadata: Metadata = {
  title: "مولّد رمز QR مجاني (عربي) | أدوات مجانية | سوق تولز",
  description:
    "أنشئ رمز QR لأي رابط أو نص خلال ثوانٍ — حجم وألوان قابلة للتخصيص، تنزيل PNG فوري، يعمل بالكامل داخل المتصفح بلا تسجيل وبلا تكلفة.",
};

export default function QrGeneratorPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        🎁 أداة مجانية بالكامل
      </span>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900">
        مولّد رمز QR
      </h1>
      <p className="mt-2 text-slate-600">
        الصق رابطاً أو أي نص واحصل فوراً على رمز QR جاهز للتنزيل أو النسخ —
        خصّص الحجم والألوان. يعمل محلياً في متصفحك، بلا تسجيل.
      </p>
      <div className="mt-6">
        <QrGenerator />
      </div>
      <div className="mt-8">
        <AdSlot position="in-content" label="أسفل مولّد QR" />
      </div>
    </div>
  );
}
