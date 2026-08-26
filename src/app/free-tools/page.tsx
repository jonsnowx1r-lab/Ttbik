import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "أدوات مجانية | سوق تولز",
  description: "أدوات مجانية بالكامل لأصحاب المشاريع الصغيرة، بلا تسجيل وبلا حدود استخدام.",
};

const TOOLS = [
  {
    href: "/free-tools/whatsapp-link",
    title: "مولد رابط الطلب عبر واتساب",
    desc: "رابط جاهز يفتح محادثة واتساب مع رسالة طلب معبّأة تلقائياً لمنتجك.",
  },
  {
    href: "/free-tools/business-name-generator",
    title: "مولد أسماء المشاريع والمتاجر",
    desc: "8 اقتراحات أسماء لمشروعك خلال ثوانٍ بالذكاء الاصطناعي.",
  },
];

export default function FreeToolsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-extrabold text-slate-900">أدوات مجانية</h1>
      <p className="mt-2 text-slate-600">بلا تسجيل، بلا حدود استخدام، ومجانية بالكامل — استخدمها كما تشاء.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
    </div>
  );
}
