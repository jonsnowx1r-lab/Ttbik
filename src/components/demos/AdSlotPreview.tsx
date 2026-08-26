"use client";

import { useState } from "react";

/**
 * Live preview of how a purchased ad slot actually looks — a mock Telegram
 * channel message the buyer can edit in real time, so the demo matches
 * exactly what they're paying for (no surprises).
 */
export default function AdSlotPreview({ channelName = "@ttbik5" }: { channelName?: string }) {
  const [business, setBusiness] = useState("اسم مشروعك");
  const [text, setText] = useState("جرّب منتجنا الجديد بخصم 20% لفترة محدودة!");
  const [link, setLink] = useState("https://example.com");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="mb-3 text-xs font-semibold text-brand-700">معاينة حية لمنشور إعلانك في القناة</p>
      <div className="grid gap-3">
        <input
          value={business}
          onChange={(e) => setBusiness(e.target.value)}
          placeholder="اسم مشروعك"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="نص الإعلان"
          rows={2}
          className="rounded-xl border border-slate-300 p-3 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="رابط منتجك/متجرك"
          dir="ltr"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

      <div className="mx-auto mt-4 max-w-xs rounded-2xl bg-[#e7ebf0] p-3">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-xs font-bold text-sky-600">{channelName}</p>
          <p className="mt-1 text-sm font-bold text-slate-900">📢 {business || "اسم مشروعك"}</p>
          <p className="mt-1 text-sm text-slate-700">{text || "نص إعلانك هنا"}</p>
          {link && (
            <p className="mt-1 break-all text-xs text-sky-600 underline" dir="ltr">
              {link}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
