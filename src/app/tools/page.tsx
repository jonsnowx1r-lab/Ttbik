import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "الأدوات | سوق تولز",
  description: "منشئ البوتات المستضافة وأدوات المتصفح.",
};

const GROUPS = [
  {
    title: "منشئ البوتات المستضافة",
    items: [
      { href: "/bots", title: "منشئ البوتات", desc: "ضع توكن بوتك واختر القالب (إعلانات، متجر، مشفى) — يعمل فوراً." },
    ],
  },
];

export default function ToolsHubPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">قسم الأدوات</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {GROUPS[0].items.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-2xl border bg-white p-5">
            <h3 className="font-bold">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-500">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
