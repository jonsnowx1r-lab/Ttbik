import type { Metadata } from "next";
import Link from "next/link";
import { BOT_TEMPLATES } from "@/lib/botTemplates";

export const metadata: Metadata = {
  title: "منشئ البوتات المستضافة | سوق تولز",
  description:
    "شغّل بوت تليجرام حقيقي بتوكنك على قوالب جاهزة: شبكة إعلانات (اربح واعلن)، حملات، متجر، عيادة، منشآت طبية.",
};

export default function BotsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-xs font-bold text-brand-700">قسم الأدوات — استضافة بوتات</p>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">منشئ البوتات العامل</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        لا نبيع ملفاً ولا كوداً للتحميل. تضع توكن البوت من BotFather، تختار قالباً، ونشغّله على خادم الموقع.
        القوائم والمحفظة والمهام تعمل داخل تليجرام؛ روابط الدفع والإيداع تُولَّد من سوق تولز بعد طلب معتمد.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {BOT_TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/bots/${t.id}`}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`flex h-28 items-center justify-center bg-gradient-to-br text-5xl text-white ${t.color}`}>
              {t.icon}
            </div>
            <div className="p-5">
              <h2 className="font-bold text-slate-900 group-hover:text-brand-700">{t.name}</h2>
              <p className="mt-1 text-xs font-semibold text-brand-700">{t.tagline}</p>
              <p className="mt-2 text-sm text-slate-500 line-clamp-3">{t.desc}</p>
              <span className="mt-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                افتح المنشئ
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
