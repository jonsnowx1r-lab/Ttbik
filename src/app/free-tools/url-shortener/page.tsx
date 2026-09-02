import type { Metadata } from "next";
import UrlShortener from "./UrlShortener";
import AdSlot from "@/components/AdSlot";

export const metadata: Metadata = {
  title: "مصغّر روابط مجاني + عداد نقرات | سوق تولز",
  description:
    "اختصر أي رابط واحصل على رابط قصير مع عداد نقرات — مجاناً، بلا تسجيل، بلا حدود يومية معقولة.",
};

export default function UrlShortenerPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        🎁 أداة مجانية بالكامل
      </span>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900">مصغّر الروابط</h1>
      <p className="mt-2 text-slate-600">
        الصق رابطاً طويلاً واحصل فوراً على رابط قصير يعمل على نطاق الموقع مع عداد نقرات حقيقي.
        لا تسجيل، لا تكلفة مستمرة.
      </p>
      <div className="mt-6">
        <UrlShortener />
      </div>
      <div className="mt-8">
        <AdSlot position="in-content" label="أسفل مصغّر الروابط" />
      </div>
    </div>
  );
}
