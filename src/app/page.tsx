import Link from "next/link";
import { supabasePublic } from "@/lib/supabase";
import type { Category, Service } from "@/types";
import StorefrontBrowser from "@/components/StorefrontBrowser";

export const revalidate = 30;

async function getStorefront() {
  const db = supabasePublic();
  const [{ data: categories }, { data: services }] = await Promise.all([
    db.from("categories").select("*").order("sort_order"),
    db.from("services").select("*").eq("is_active", true).order("sort_order"),
  ]);
  return {
    categories: (categories ?? []) as Category[],
    services: (services ?? []) as Service[],
  };
}

export default async function HomePage() {
  const { categories, services } = await getStorefront();
  // "automation-sites" deliberately excluded — every service that ever
  // lived under it is now retired (locked-code products), so the tab
  // would only ever show an empty "لا توجد خدمات" state.
  const visible = categories.filter((c) => ["telegram-bots", "creative-studio"].includes(c.slug));

  return (
    <div>
      <section className="bg-hero-glow bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-14 text-center sm:pb-14 sm:pt-20">
          <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-bold text-brand-700">
            أدوات تعمل فعلياً — وليست ملفات للتحميل
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
            شغّل بوت تليجرام بتوكنك، أو استخدم أداة داخل المتصفح
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            منشئ البوتات يستضيف القالب على الموقع. روابط الإيداع والسحب تُولَّد من هنا وتربط رصيد البوت بتحويل بنكي أو USDT بعد المراجعة.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/bots" className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
              منشئ البوتات
            </Link>
            <Link href="/tools" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              كل الأدوات
            </Link>
            <Link href="/free-tools" className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-emerald-700">
              أدوات مجانية
            </Link>
          </div>
        </div>
      </section>

      {visible.length > 0 && <StorefrontBrowser categories={visible} services={services} />}
    </div>
  );
}
