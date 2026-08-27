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

  return (
    <div>
      <section className="bg-hero-glow bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-center sm:pb-14 sm:pt-20">
          <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-bold text-brand-700">
            🚀 السوق العربي لخدمات وأدوات رقمية جاهزة
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
            أدوات وخدمات رقمية حقيقية، بتكلفة تشغيل <span className="text-brand-600">صفر دولار</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            جرّب كل أداة مباشرة قبل الشراء، ثم احصل على وصولك الكامل خلال دقائق عبر تحويل بسيط
            (بنكي أو USDT) وموافقة إدارية سريعة.
          </p>
          <div className="mx-auto mt-7 flex max-w-xl flex-wrap items-center justify-center gap-2.5 text-xs font-semibold text-slate-600 sm:text-sm">
            <span className="rounded-full bg-white px-3.5 py-1.5 shadow-sm ring-1 ring-slate-200">⚡ تسليم فوري</span>
            <span className="rounded-full bg-white px-3.5 py-1.5 shadow-sm ring-1 ring-slate-200">🔒 دفع آمن</span>
            <span className="rounded-full bg-white px-3.5 py-1.5 shadow-sm ring-1 ring-slate-200">🧪 جرّب قبل الشراء</span>
            <span className="rounded-full bg-white px-3.5 py-1.5 shadow-sm ring-1 ring-slate-200">💬 دعم عبر تليجرام</span>
          </div>
        </div>
      </section>

      <StorefrontBrowser categories={categories} services={services} />
    </div>
  );
}
