"use client";

import { useState } from "react";

/**
 * Client-side-only live preview builder — demonstrates the landing-page /
 * automation template products with zero backend cost.
 */
export default function LandingBuilder() {
  const [name, setName] = useState("مشروعي الجديد");
  const [tagline, setTagline] = useState("حلول رقمية تساعدك تنمو أسرع");
  const [color, setColor] = useState("#0284c7");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="mb-3 text-xs font-semibold text-brand-700">معاينة حية — عدّل الحقول وشاهد النتيجة فوراً</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم مشروعك"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="الشعار التسويقي"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-full cursor-pointer rounded-xl border border-slate-300"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <div className="p-8 text-center text-white" style={{ backgroundColor: color }}>
          <h3 className="text-2xl font-extrabold">{name || "اسم مشروعك"}</h3>
          <p className="mt-2 opacity-90">{tagline || "الشعار التسويقي"}</p>
          <button className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-bold" style={{ color }}>
            ابدأ الآن
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        القالب الكامل قابل للنشر مجاناً على Vercel ويشمل عدة أقسام (مميزات، أسعار، تواصل).
      </p>
    </div>
  );
}
