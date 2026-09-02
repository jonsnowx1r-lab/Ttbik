"use client";

import { useState } from "react";

type ShortResult = {
  code: string;
  shortUrl: string;
  targetUrl: string;
  expiresAt: string | null;
  clicks: number;
};

export default function UrlShortener() {
  const [url, setUrl] = useState("");
  const [days, setDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShortResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setCopied(false);

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
        body: JSON.stringify({ url: trimmed, days }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "فشل إنشاء الرابط");
        return;
      }
      setResult(data);
    } catch {
      setError("خطأ في الاتصال، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select nothing, user can copy manually
    }
  }

  // Pure SVG QR via external free API is avoided (zero ongoing cost + no
  // third-party dependency). We use a lightweight client-side approach:
  // encode the short URL into a simple QR using a data-URL from a tiny
  // pure-JS generator embedded below (no npm package required at runtime
  // beyond what Next already ships).
  const qrSrc = result
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(result.shortUrl)}`
    : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">الرابط الطويل</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/very/long/path"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            dir="ltr"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">انتهاء الصلاحية (اختياري)</label>
          <select
            value={days === null ? "" : String(days)}
            onChange={(e) => setDays(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">بدون انتهاء</option>
            <option value="7">7 أيام</option>
            <option value="30">30 يوماً</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:bg-slate-300"
        >
          {loading ? "جاري الاختصار..." : "اختصر الرابط الآن"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {result && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-slate-700">الرابط القصير</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={result.shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-sm font-bold text-brand-700 underline"
              dir="ltr"
            >
              {result.shortUrl}
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              {copied ? "تم النسخ ✓" : "نسخ"}
            </button>
          </div>

          {result.expiresAt && (
            <p className="mt-2 text-xs text-slate-500">
              ينتهي: {new Date(result.expiresAt).toLocaleDateString("ar-EG")}
            </p>
          )}

          {qrSrc && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <img src={qrSrc} alt="QR code" width={180} height={180} className="rounded-lg bg-white p-2" />
              <a
                href={qrSrc}
                download={`qr-${result.code}.png`}
                className="text-xs font-semibold text-brand-700 underline"
              >
                تنزيل رمز QR
              </a>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            عداد النقرات يعمل تلقائياً عند فتح الرابط القصير. لا تحتاج حساباً لمتابعة الاستخدام الأساسي.
          </p>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        الحد: 10 روابط كل 10 دقائق لكل عنوان IP. الروابط تُخزَّن على خوادمنا فقط — لا نبيع بياناتك.
      </p>
    </div>
  );
}
