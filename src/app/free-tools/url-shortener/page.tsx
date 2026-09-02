import type { Metadata } from "next";
import UrlShortener from "./UrlShortener";

export const metadata: Metadata = {
  title: "مصغّر روابط مجاني + QR + عداد نقرات | سوق تولز",
  description:
    "اختصر روابطك مجاناً، احصل على رمز QR، وتتبع عدد النقرات — بلا تسجيل وبلا حدود استخدام معقولة.",
};

export default function UrlShortenerPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        🎁 أداة مجانية بالكامل
      </span>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900">مصغّر الروابط + QR</h1>
      <p className="mt-2 text-slate-600">
        الصق أي رابط طويل، واحصل فوراً على رابط قصير يعمل على نطاق الموقع مع رمز QR وعداد نقرات
        تلقائي. مجاني بالكامل، بلا تسجيل.
      </p>
      <div className="mt-6">
        <UrlShortener />
      </div>
    </div>
  );
}
