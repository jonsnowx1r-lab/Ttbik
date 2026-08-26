"use client";

import { useState } from "react";
import Link from "next/link";

export default function BusinessNameGenerator() {
  const [description, setDescription] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (!description.trim() || loading) return;
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const res = await fetch("/api/free-tools/business-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "تعذّر توليد الأسماء");
      setOutput(data.output);
    } catch (e: any) {
      setError(e.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="مثال: متجر إلكتروني لبيع القهوة المختصة، أو محل حلويات منزلية..."
        rows={3}
        className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-brand-500 focus:outline-none"
      />
      <button
        onClick={generate}
        disabled={loading || !description.trim()}
        className="mt-3 rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "جارٍ التوليد..." : "اقترح أسماء الآن"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {output && (
        <div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{output}</div>
      )}

      <div className="mt-6 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-4 text-sm text-slate-600">
        اخترت اسماً؟ الخطوة التالية: أنشئ لمشروعك{" "}
        <Link href="/service/landing-page-generator" className="font-bold text-brand-700 underline">
          صفحة هبوط احترافية
        </Link>{" "}
        أو{" "}
        <Link href="/free-tools/whatsapp-link" className="font-bold text-brand-700 underline">
          رابط طلب واتساب مجاني
        </Link>
        .
      </div>
    </div>
  );
}
