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
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-16 text-center">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
          خدمات وأدوات رقمية جاهزة، بتكلفة تشغيل <span className="text-brand-600">صفر دولار</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-600">
          جرّب كل أداة مباشرة قبل الشراء، ثم احصل على وصولك الكامل خلال دقائق عبر تحويل بسيط
          (بنكي أو USDT) وموافقة إدارية سريعة.
        </p>
      </section>

      <StorefrontBrowser categories={categories} services={services} />
    </div>
  );
}
