"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MODES = [
  { key: "summarize", label: "تلخيص تقرير أو مستند", placeholder: "الصق نص التقرير أو المستند الطويل هنا..." },
  { key: "reviews", label: "تحليل آراء العملاء بالجملة", placeholder: "الصق تقييمات العملاء، كل تقييم في سطر منفصل..." },
] as const;

export default function TextAnalyzer() {
  const router = useRouter();
  const [mode, setMode] = useState<(typeof MODES)[number]["key"]>("summarize");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const current = MODES.find((m) => m.key === mode)!;

  async function analyze() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/free-tools/text-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "تعذّر تحليل النص");
      router.push(`/free-tools/text-analyzer/result?mode=${mode}&output=${encodeURIComponent(data.output)}`);
    } catch (e: any) {
      setError(e.message || "حدث خطأ غير متوقع");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              mode === m.key ? "border-sky-600 bg-sky-50 text-sky-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={current.placeholder}
        rows={7}
        className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-sky-500 focus:outline-none"
      />
      <button
        onClick={analyze}
        disabled={loading || !input.trim()}
        className="mt-3 rounded-xl bg-sky-700 px-5 py-2 text-sm font-bold text-white transition hover:bg-sky-800 disabled:opacity-50"
      >
        {loading ? "جارٍ التحليل..." : "حلّل الآن"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
