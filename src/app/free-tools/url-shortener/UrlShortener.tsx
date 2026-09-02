"use client";

import { useState } from "react";
import Link from "next/link";

export default function UrlShortener() {
  const [url, setUrl] = useState("");
  const [expiresDays, setExpiresDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ shortUrl: string; code: string; clicks: number } | null>(null);
  const [copied, setCopied] = useState(false);

  async function shorten() {
    setError("");
    setResult(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("أدخل الرابط أولاً");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tools/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, expiresDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "فشل الاختصار");
        return;
      }
      setResult({ shortUrl: data.shortUrl, code: data.code, clicks: data.clicks ?? 0 });
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result.shortUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="grid gap-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/صفحة-طويلة..."
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          dir="ltr"
        />
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-slate-500">صلاحية:</span>
          {[
            { label: "بدون انتهاء", v: null },
            { label: "7 أيام", v: 7 },
            { label: "30 يوم", v: 30 },
          ].map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => setExpiresDays(opt.v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                expiresDays === opt.v
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={shorten}
          disabled={loading}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "جاري الاختصار..." : "اختصر الرابط"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {result && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">الرابط القصير:</p>
          <p className="break-all font-mono text-sm text-brand-700" dir="ltr">
            {result.shortUrl}
          </p>
          <p className="mt-1 text-xs text-slate-500">النقرات حتى الآن: {result.clicks}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
            >
              {copied ? "✅ تم النسخ" : "نسخ الرابط"}
            </button>
            <a
              href={result.shortUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-brand-300"
            >
              فتح
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            لمشاركة QR: انسخ الرابط والصقه في أي مولّد QR مجاني، أو استخدمه مباشرة في منشوراتك.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-4 text-sm text-slate-600">
        أداة حقيقية على نطاق الموقع — ليست مجرد عرض كود. للاحتياجات المتقدمة (نطاق فرعي مخصص، صفحات
        روابط متعددة) راجع{" "}
        <Link href="/free-tools" className="font-bold text-brand-700 underline">
          باقي الأدوات المجانية
        </Link>
        .
      </div>
    </div>
  );
}
