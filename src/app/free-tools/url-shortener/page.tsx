import type { Metadata } from "next";
import UrlShortener from "./UrlShortener";

export const metadata: Metadata = {
  title: "مصغّر روابط مجاني + QR + عداد نقرات | سوق تولز",
  description:
    "اختصر أي رابط طويل، احصل على رمز QR، وتابع عدد النقرات — مجاناً وبلا تسجيل وبلا حدود شهرية.",
};

export default function UrlShortenerPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        🎁 أداة مجانية بالكامل
      </span>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900">مصغّر روابط + QR</h1>
      <p className="mt-2 text-slate-600">
        الصق أي رابط طويل، احصل فوراً على رابط قصير يعمل على موقعنا + رمز QR قابل للتنزيل، مع عداد نقرات
        حقيقي. بلا تسجيل وبلا حدود شهرية.
      </p>
      <div className="mt-6">
        <UrlShortener />
      </div>
    </div>
  );
}
