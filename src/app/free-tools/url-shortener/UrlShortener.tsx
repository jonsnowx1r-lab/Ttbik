"use client";

import { useState } from "react";

type Result = {
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
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tools/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), days }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return;
      }
      setResult(data);
    } catch {
      setError("تعذّر الاتصال بالخادم، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!result) return;
    navigator.clipboard.writeText(result.shortUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const qrSrc = result
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(result.shortUrl)}`
    : "";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <form onSubmit={handleSubmit} className="grid gap-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="الصق الرابط الطويل هنا (https://...)"
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          dir="ltr"
          required
        />

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="self-center text-slate-500">صلاحية الرابط:</span>
          {[
            { v: null, label: "بدون انتهاء" },
            { v: 7, label: "7 أيام" },
            { v: 30, label: "30 يوماً" },
          ].map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => setDays(opt.v)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                days === opt.v
                  ? "bg-brand-600 text-white"
                  : "border border-slate-300 text-slate-600 hover:border-brand-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="mt-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "جاري التقصير..." : "اختصر الرابط"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {result && (
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="mb-1 text-xs font-semibold text-slate-500">الرابط القصير:</p>
          <p className="break-all font-mono text-base font-bold text-brand-700" dir="ltr">
            {result.shortUrl}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={copyLink}
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
              فتح الرابط
            </a>
          </div>

          <div className="mt-5 flex flex-col items-center gap-2 border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-500">رمز QR جاهز للطباعة أو المشاركة</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt="QR code"
              width={180}
              height={180}
              className="rounded-lg border border-slate-200 bg-white p-1"
            />
            <p className="text-[11px] text-slate-400">
              النقرات تُحسب تلقائياً عند استخدام الرابط القصير
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-4 text-sm text-slate-600">
        أداة مجانية بالكامل — لا تسجيل، لا حدود يومية معقولة، ولا تكلفة تشغيل. الرابط يعمل
        مباشرة على نطاق الموقع ويُحتسب عدد النقرات.
      </div>
    </div>
  );
}
