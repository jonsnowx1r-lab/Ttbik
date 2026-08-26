"use client";

import { useState } from "react";
import Link from "next/link";
import type { Category, Service } from "@/types";
import { formatUsd } from "@/lib/utils";
import { getDeliveryKind } from "@/lib/deliveryKind";
import CategoryBanner, { CategoryIcon } from "@/components/CategoryBanner";

/**
 * Sidebar-driven category browser: only the selected category's services
 * render at a time, instead of stacking every category on one long page.
 * Keeps the page tidy as more sections/services are added over time.
 */
export default function StorefrontBrowser({
  categories,
  services,
}: {
  categories: Category[];
  services: Service[];
}) {
  const [activeId, setActiveId] = useState(categories[0]?.id);
  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  if (!active) return null;

  const activeServices = services.filter((s) => s.category_id === active.id);

  return (
    <section id="categories" className="mx-auto max-w-6xl px-4 pb-20">
      {/* Mobile: horizontal pill selector */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden [&::-webkit-scrollbar]:hidden">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveId(cat.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              cat.id === active.id
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
            }`}
          >
            <CategoryIcon slug={cat.slug} className="h-4 w-4" /> {cat.name_ar}
          </button>
        ))}
      </div>

      <div className="lg:flex lg:items-start lg:gap-8">
        {/* Desktop: persistent sidebar */}
        <aside className="hidden shrink-0 lg:block lg:w-60">
          <nav className="sticky top-24 space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveId(cat.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  cat.id === active.id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <CategoryIcon slug={cat.slug} className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-right">{cat.name_ar}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Active category content */}
        <div className="min-w-0 flex-1">
          <CategoryBanner slug={active.slug} />
          <div className="mb-6 mt-4">
            <h2 className="text-xl font-bold text-slate-900">{active.name_ar}</h2>
            {active.description_ar && <p className="mt-1 text-sm text-slate-500">{active.description_ar}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeServices.map((s) => (
              <Link
                key={s.id}
                href={`/service/${s.slug}`}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                    {getDeliveryKind(s).label}
                  </span>
                  <h3 className="mt-2 font-bold text-slate-900 group-hover:text-brand-700">{s.name_ar}</h3>
                  <p className="mt-2 text-sm text-slate-500">{s.short_desc_ar}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-extrabold text-brand-700">{formatUsd(s.price_usd)}</span>
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                    جرّب النسخة المحدودة
                  </span>
                </div>
              </Link>
            ))}
            {activeServices.length === 0 && (
              <p className="col-span-full text-sm text-slate-400">لا توجد خدمات في هذا القسم حالياً.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
