import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import AdsterraNative from "@/components/AdsterraNative";
import SectionBackdrop from "@/components/SectionBackdrop";
import { FREE_TOOLS } from "@/lib/freeTools";
import { LIVE_BOTS } from "@/lib/liveBots";

export const metadata: Metadata = {
  title: "أدوات مجانية | سوق تولز",
  description: "أدوات مجانية بالكامل لأصحاب المشاريع الصغيرة، بلا تسجيل وبلا حدود استخدام.",
};

const TOOLS = FREE_TOOLS;

export default function FreeToolsPage() {
  return (
    <div className="relative mx-auto max-w-3xl px-4 py-12">
      <SectionBackdrop tone="free-tools" />
      <h1 className="text-2xl font-extrabold text-slate-900">أدوات مجانية</h1>
      <p className="mt-2 text-slate-600">بلا تسجيل، بلا حدود استخدام، ومجانية بالكامل — استخدمها كما تشاء.</p>

      <a
        href="https://literium.ai.studio"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 flex items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div>
          <span className="inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">إعلان</span>
          <h2 className="mt-2 font-bold text-slate-900">Literium AI Studio</h2>
          <p className="mt-1 text-sm text-slate-600">literium.ai.studio</p>
        </div>
        <span className="shrink-0 text-brand-700">←</span>
      </a>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
              مجاني
            </span>
            <h2 className="mt-2 font-bold text-slate-900 group-hover:text-brand-700">{tool.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{tool.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <AdSlot position="in-content" label="بين الأدوات والبوتات" />
      </div>

      {/* Native Banner — this specific Adsterra unit can only render once
          per page (its container id is fixed, see AdsterraNative.tsx), so
          it's placed directly here rather than through the reusable
          AdSlot, which some pages call twice. This listing page is the
          best contextual fit for a native ad anyway. */}
      <div className="mt-6">
        <AdsterraNative />
      </div>

      <h2 className="mt-10 text-lg font-extrabold text-slate-900">🤖 جرّب بوتاتنا الآن على تليجرام</h2>
      <p className="mt-1 text-sm text-slate-600">بوتات حقيقية تعمل الآن — افتحها وجرّبها مباشرة على تليجرام.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {LIVE_BOTS.map((bot) => (
          <a
            key={bot.href}
            href={bot.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="inline-block rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">
              افتح على تليجرام
            </span>
            <h2 className="mt-2 font-bold text-slate-900 group-hover:text-brand-700">{bot.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{bot.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
