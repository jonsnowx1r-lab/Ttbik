import Link from "next/link";
import { supabasePublic } from "@/lib/supabase";
import type { Category, Service } from "@/types";
import { formatUsd } from "@/lib/utils";
import { getDeliveryKind } from "@/lib/deliveryKind";
import CategoryBanner, { CategoryIcon } from "@/components/CategoryBanner";

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

      {/* Horizontal quick-jump pills */}
      <nav
        aria-label="الانتقال السريع للأقسام"
        className="sticky top-[57px] z-20 border-y border-slate-200 bg-white/90 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`#${cat.slug}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
            >
              <CategoryIcon slug={cat.slug} className="h-4 w-4" /> {cat.name_ar}
            </a>
          ))}
        </div>
      </nav>

      <section id="categories" className="mx-auto max-w-6xl space-y-16 px-4 py-14">
        {categories.map((cat) => (
          <div key={cat.id} id={cat.slug} className="scroll-mt-28">
            <CategoryBanner slug={cat.slug} />
            <div className="mb-5 mt-4 flex items-center gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{cat.name_ar}</h2>
                {cat.description_ar && (
                  <p className="text-sm text-slate-500">{cat.description_ar}</p>
                )}
              </div>
            </div>

            {/* Horizontal swipeable row on mobile, grid from sm breakpoint up */}
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {services
                .filter((s) => s.category_id === cat.id)
                .map((s) => (
                  <Link
                    key={s.id}
                    href={`/service/${s.slug}`}
                    className="group flex w-[78vw] shrink-0 snap-start flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-auto sm:shrink"
                  >
                    <div>
                      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                        {getDeliveryKind(s).label}
                      </span>
                      <h3 className="mt-2 font-bold text-slate-900 group-hover:text-brand-700">
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
