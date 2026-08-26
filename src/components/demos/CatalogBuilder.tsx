"use client";

import { useState } from "react";

/**
 * Live, working demo of the WhatsApp mini-catalog product: editable product
 * card + a genuinely functional "Order via WhatsApp" button (wa.me deep
 * link), so the demo matches exactly what the delivered template does.
 */
export default function CatalogBuilder() {
  const [name, setName] = useState("قهوة عربية مختصة");
  const [price, setPrice] = useState("45 ريال");
  const [whatsapp, setWhatsapp] = useState("9665XXXXXXXX");

  const message = encodeURIComponent(`مرحباً، أريد أطلب: ${name || "المنتج"} (${price || ""})`);
  const waLink = `https://wa.me/${whatsapp.replace(/\D/g, "") || "9665XXXXXXXX"}?text=${message}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="mb-3 text-xs font-semibold text-brand-700">معاينة حية — عدّل الحقول وجرّب زر الطلب فعلياً</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم المنتج"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="السعر"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="رقم واتساب (بصيغة دولية)"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

      <div className="mx-auto mt-4 max-w-[220px] overflow-hidden rounded-2xl border border-slate-200">
        <div className="flex aspect-square items-center justify-center bg-slate-100 text-4xl">🛍️</div>
        <div className="p-3">
          <h4 className="font-bold text-slate-900">{name || "اسم المنتج"}</h4>
          <p className="mt-1 font-extrabold text-emerald-600">{price || "السعر"}</p>
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            🟢 اطلب عبر واتساب
          </a>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">
        القالب الكامل يدعم عدد لا نهائي من المنتجات في صفحة واحدة.
      </p>
    </div>
  );
}
