"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MODES = [
  { key: "caption", label: "منشور سوشيال ميديا", placeholder: "مثال: مقهى مختص يطلق نكهة قهوة موسمية جديدة" },
  { key: "blog", label: "مقالة مدونة", placeholder: "مثال: فوائد القهوة المختصة" },
  { key: "product-desc", label: "وصف منتج", placeholder: "مثال: حقيبة جلدية يدوية الصنع، مقاس متوسط، بني غامق" },
  { key: "translate", label: "ترجمة نص عمل", placeholder: "الصق النص المراد ترجمته (عربي أو إنجليزي)..." },
] as const;

export default function WritingAssistant() {
  const router = useRouter();
  const [mode, setMode] = useState<(typeof MODES)[number]["key"]>("caption");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const current = MODES.find((m) => m.key === mode)!;

  async function generate() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/free-tools/writing-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "تعذّر توليد النص");
      router.push(`/free-tools/writing-assistant/result?mode=${mode}&output=${encodeURIComponent(data.output)}`);
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
              mode === m.key ? "border-rose-600 bg-rose-50 text-rose-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
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
        rows={mode === "translate" ? 6 : 3}
        className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-rose-500 focus:outline-none"
      />
      <button
        onClick={generate}
        disabled={loading || !input.trim()}
        className="mt-3 rounded-xl bg-rose-700 px-5 py-2 text-sm font-bold text-white transition hover:bg-rose-800 disabled:opacity-50"
      >
        {loading ? "جارٍ التوليد..." : "توليد الآن"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
