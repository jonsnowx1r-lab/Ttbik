"use client";

import { useState } from "react";

type Result = {
  code: string;
  shortUrl: string;
  qrDataUrl: string;
  clicks: number;
  expiresAt: string | null;
};

export default function UrlShortener() {
  const [url, setUrl] = useState("");
  const [expireDays, setExpireDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("أدخل رابطاً أولاً");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tools/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, expireDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return;
      }
      setResult(data as Result);
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
      <form onSubmit={submit} className="grid gap-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/صفحة-طويلة جداً"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          dir="ltr"
        />
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-slate-500 self-center">صلاحية:</span>
          {[
            { v: null, label: "بلا انتهاء" },
            { v: 7, label: "7 أيام" },
            { v: 30, label: "30 يوماً" },
          ].map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => setExpireDays(opt.v)}
              className={`rounded-lg px-3 py-1.5 font-semibold ${
                expireDays === opt.v
                  ? "bg-brand-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:border-brand-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "جاري التقصير…" : "اختصر الرابط"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {result && (
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="mb-1 text-xs font-semibold text-slate-500">الرابط القصير:</p>
          <p className="break-all font-mono text-sm text-brand-700" dir="ltr">
            {result.shortUrl}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
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
            {result.expiresAt && (
              <span className="text-xs text-slate-500">
                ينتهي: {new Date(result.expiresAt).toLocaleDateString("ar")}
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-col items-start gap-2">
            <p className="text-xs font-semibold text-slate-500">رمز QR:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.qrDataUrl}
              alt="QR code"
              width={160}
              height={160}
              className="rounded-lg border border-slate-200 bg-white"
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            عداد النقرات يبدأ من صفر ويُحدَّث مع كل زيارة للرابط القصير.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-4 text-sm text-slate-600">
        أداة مجانية بالكامل — رابط قصير + QR + عداد نقرات، بلا تسجيل وبلا تكلفة جارية.
        لا نبيع الكود؛ الأداة تعمل فعلياً على الخادم.
      </div>
    </div>
  );
}
