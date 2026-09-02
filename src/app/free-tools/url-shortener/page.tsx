import type { Metadata } from "next";
import UrlShortener from "./UrlShortener";

export const metadata: Metadata = {
  title: "مصغّر روابط مجاني + QR + عداد نقرات | سوق تولز",
  description:
    "اختصر روابطك مجاناً واحصل على رمز QR وعداد نقرات حقيقي — بلا تسجيل وبلا حدود يومية مدفوعة.",
};

export default function UrlShortenerPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        🎁 أداة مجانية بالكامل
      </span>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900">مصغّر روابط + QR + عداد نقرات</h1>
      <p className="mt-2 text-slate-600">
        الصق أي رابط طويل واحصل فوراً على رابط قصير يعمل على خادمنا، مع رمز QR جاهز للطباعة أو المشاركة،
        وعداد نقرات يتحدث مع كل زيارة. بلا تسجيل وبلا اشتراك.
      </p>
      <div className="mt-6">
        <UrlShortener />
      </div>
    </div>
  );
}
