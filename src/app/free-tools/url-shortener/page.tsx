import type { Metadata } from "next";
import Link from "next/link";
import UrlShortener from "./UrlShortener";
import AdSlot from "@/components/AdSlot";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata: Metadata = {
  title: "مصغّر روابط مجاني + عداد نقرات | سوق تولز",
  description:
    "اختصر أي رابط واحصل على رابط قصير مع عداد نقرات — مجاناً، بلا تسجيل، بلا حدود يومية معقولة.",
  alternates: {
    canonical: `${SITE_URL}/free-tools/url-shortener`,
    languages: {
      ar: `${SITE_URL}/free-tools/url-shortener`,
      en: `${SITE_URL}/en/free-tools/url-shortener`,
      "x-default": `${SITE_URL}/free-tools/url-shortener`,
    },
  },
};

export default function UrlShortenerPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          🎁 أداة مجانية بالكامل
        </span>
        <Link href="/en/free-tools/url-shortener" className="text-xs font-semibold text-slate-500 hover:text-brand-700">
          🇬🇧 English
        </Link>
      </div>
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
