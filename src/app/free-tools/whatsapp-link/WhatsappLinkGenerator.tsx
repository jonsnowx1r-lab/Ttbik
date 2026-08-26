"use client";

import { useState } from "react";
import Link from "next/link";

export default function WhatsappLinkGenerator() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [number, setNumber] = useState("");
  const [copied, setCopied] = useState(false);

  const digitsOnly = number.replace(/\D/g, "");
  const message = encodeURIComponent(`مرحباً، أريد أطلب: ${name || "المنتج"}${price ? ` (${price})` : ""}`);
  const link = digitsOnly ? `https://wa.me/${digitsOnly}?text=${message}` : "";

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="grid gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم المنتج أو الخدمة"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="السعر (اختياري)"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="رقم واتساب بصيغة دولية، مثال: 9665XXXXXXXX"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          dir="ltr"
        />
      </div>

      {link && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">رابط الطلب الجاهز:</p>
          <p className="break-all font-mono text-sm text-brand-700" dir="ltr">
            {link}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={copyLink}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
            >
              {copied ? "✅ تم النسخ" : "نسخ الرابط"}
            </button>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-300"
            >
              فتح في واتساب
            </a>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-4 text-sm text-slate-600">
        هذه الأداة مجانية تماماً لمنتج واحد بلا حدود استخدام. إن كان لديك أكثر من منتج، احصل على{" "}
        <Link href="/service/whatsapp-catalog" className="font-bold text-brand-700 underline">
          صفحة كتالوج كاملة لكل منتجاتك
        </Link>{" "}
        بزر طلب واتساب لكل منتج تلقائياً.
      </div>
    </div>
  );
}
