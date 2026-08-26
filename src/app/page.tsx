import Link from "next/link";
import { supabasePublic } from "@/lib/supabase";
import type { Category, Service } from "@/types";
import { formatUsd } from "@/lib/utils";

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
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
          خدمات وأدوات رقمية جاهزة، بتكلفة تشغيل <span className="text-brand-600">صفر دولار</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-600">
          جرّب كل أداة مباشرة قبل الشراء، ثم احصل على وصولك الكامل خلال دقائق عبر تحويل بسيط
          (IBAN أو USDT) وموافقة إدارية سريعة.
        </p>
      </section>

      <section id="categories" className="mx-auto max-w-6xl space-y-14 px-4 pb-20">
        {categories.map((cat) => (
          <div key={cat.id}>
            <div className="mb-5 flex items-center gap-3">
              <span className="text-3xl">{cat.icon}</span>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{cat.name_ar}</h2>
                {cat.description_ar && (
                  <p className="text-sm text-slate-500">{cat.description_ar}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services
                .filter((s) => s.category_id === cat.id)
                .map((s) => (
                  <Link
                    key={s.id}
                    href={`/service/${s.slug}`}
                    className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-brand-700">
                        {s.name_ar}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">{s.short_desc_ar}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-lg font-extrabold text-brand-700">
                        {formatUsd(s.price_usd)}
                      </span>
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                        جرّب النسخة المحدودة
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
