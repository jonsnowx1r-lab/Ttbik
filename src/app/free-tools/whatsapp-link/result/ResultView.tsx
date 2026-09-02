"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ResultView() {
  const params = useSearchParams();
  const link = params.get("link") || "";
  const [copied, setCopied] = useState(false);

  if (!link) {
    return <p className="text-slate-500">لا يوجد رابط — عد للأداة وجرّب مجدداً.</p>;
  }

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="mb-2 text-xs font-semibold text-slate-500">رابط الطلب الجاهز:</p>
      <p className="break-all font-mono text-sm text-brand-700" dir="ltr">
        {link}
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={copyLink} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">
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
  );
}
