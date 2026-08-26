"use client";

import { useState } from "react";
import type { ToolMode } from "@/lib/prompts";

export default function ToolRunner({
  tool,
  initialOrderCode,
  placeholder,
  buttonLabel,
  isOwner,
}: {
  tool: ToolMode;
  initialOrderCode: string;
  placeholder: string;
  buttonLabel: string;
  isOwner?: boolean;
}) {
  const [orderCode, setOrderCode] = useState(initialOrderCode);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canRun = isOwner || orderCode.trim();

  async function run() {
    if (!canRun || !input.trim() || loading) return;
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const res = await fetch("/api/tools/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode: orderCode.trim().toUpperCase() || undefined, tool, input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "تعذّر تشغيل الأداة");
      setOutput(data.output);
    } catch (e: any) {
      setError(e.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      {!isOwner && (
        <>
          <label className="mb-1 block text-xs font-semibold text-slate-500">رمز طلبك (مثال: ORD-A1B2C3D4)</label>
          <input
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
            placeholder="ORD-XXXXXXXX"
            className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none"
          />
        </>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-brand-500 focus:outline-none"
      />
      <button
        onClick={run}
        disabled={loading || !input.trim() || !canRun}
        className="mt-3 rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "جارٍ المعالجة..." : buttonLabel}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {output && (
        <div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{output}</div>
      )}
    </div>
  );
}
