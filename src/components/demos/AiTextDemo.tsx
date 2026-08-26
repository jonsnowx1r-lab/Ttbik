"use client";

import { useState } from "react";

/**
 * Real, working demo for the "ai_chat" and "content_ai" service types.
 * Calls our own /api/demo/ai route (which in turn calls the free Groq API),
 * so it costs nothing to run and genuinely demonstrates the product.
 */
export default function AiTextDemo({
  mode,
  placeholder,
  buttonLabel,
}: {
  mode: "translate" | "summarize" | "assistant" | "caption" | "blog" | "product-desc";
  placeholder: string;
  buttonLabel: string;
}) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const res = await fetch("/api/demo/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, input: input.slice(0, 500) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "تعذّر تشغيل التجربة الآن");
      setOutput(data.output);
    } catch (e: any) {
      setError(e.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="mb-2 text-xs font-semibold text-brand-700">
        تجربة حية محدودة (500 حرف كحد أقصى)
      </p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        maxLength={500}
        rows={4}
        className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-brand-500 focus:outline-none"
      />
      <button
        onClick={run}
        disabled={loading || !input.trim()}
        className="mt-3 rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "جارٍ المعالجة..." : buttonLabel}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {output && (
        <div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          {output}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        هذه نسخة محدودة للتجربة فقط. النسخة الكاملة بدون حد للأحرف وبأداء أسرع.
      </p>
    </div>
  );
}
