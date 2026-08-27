"use client";

import { useState } from "react";

export default function StudioGate({
  tool,
  initialOrderCode,
  isOwner,
  children,
}: {
  tool: string;
  initialOrderCode: string;
  isOwner: boolean;
  children: React.ReactNode;
}) {
  const [orderCode, setOrderCode] = useState(initialOrderCode);
  const [unlocked, setUnlocked] = useState(isOwner);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    if (!orderCode.trim() || checking) return;
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/tools/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode: orderCode.trim().toUpperCase(), tool }),
      });
      const data = await res.json();
      if (!res.ok || !data.unlocked) throw new Error(data?.error || "رمز الطلب غير صالح");
      setUnlocked(true);
    } catch (e: any) {
      setError(e.message || "حدث خطأ غير متوقع");
    } finally {
      setChecking(false);
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <label className="mb-1 block text-xs font-semibold text-slate-500">رمز طلبك (مثال: ORD-A1B2C3D4)</label>
      <input
        value={orderCode}
        onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && verify()}
        placeholder="ORD-XXXXXXXX"
        className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none"
      />
      <button
        onClick={verify}
        disabled={checking || !orderCode.trim()}
        className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {checking ? "جارٍ التحقق..." : "فتح الأداة"}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
