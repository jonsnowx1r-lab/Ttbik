"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BotTemplate } from "@/lib/botTemplates";

export default function BotBuilder({
  template,
  initialOrderCode = "",
}: {
  template: BotTemplate;
  initialOrderCode?: string;
}) {
  const [token, setToken] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [orderCode, setOrderCode] = useState(initialOrderCode);
  const [welcome, setWelcome] = useState(template.defaults.welcome);
  const [faq, setFaq] = useState(template.defaults.faq);
  const [products, setProducts] = useState(
    template.id === "clinic" ? "استشارة عامة\nفحص دوري" : "منتج تجريبي — 10 نقاط"
  );
  const [merchantTgId, setMerchantTgId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => welcome || template.defaults.welcome, [welcome, template.defaults.welcome]);

  async function launch() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/bots/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: template.id,
          token,
          ownerContact,
          orderCode,
          welcome,
          faq,
          products: template.id === "store" || template.id === "clinic" ? products : "",
          merchantTgId: template.id === "store" ? merchantTgId.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.detail].filter(Boolean).join("\n") || "فشل التشغيل");
      setResult(`${data.message}\n${data.bot?.bot_username || ""}\nرمز البوت: ${data.bot?.public_code || ""}`);
    } catch (e: any) {
      setError(e.message || "خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form className="space-y-4 rounded-2xl border bg-white p-5" onSubmit={(e) => { e.preventDefault(); launch(); }}>
        <div>
          <label className="text-sm font-bold">رمز الطلب المعتمد</label>
          <input
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono"
            placeholder="TB-...."
          />
          <p className="mt-1 text-xs text-slate-500">
            لا تملك رمزاً بعد؟{" "}
            <Link href="/how-it-works" className="font-semibold text-brand-700 underline">
              اطلب خدمة «إنشاء بوت مستضاف» أولاً وشاهد كيف تحصل عليه
            </Link>
            . بدون طلب موافق لا يُشغّل البوت. يُملأ تلقائياً من ?order= في الرابط بعد الموافقة.
          </p>
        </div>
        <div>
          <label className="text-sm font-bold">توكن @BotFather</label>
          <input value={token} onChange={(e) => setToken(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-sm" required placeholder="123456789:AA...." />
        </div>
        <div>
          <label className="text-sm font-bold">تواصل المالك</label>
          <input value={ownerContact} onChange={(e) => setOwnerContact(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" required />
        </div>
        {template.id === "store" && (
          <div>
            <label className="text-sm font-bold">آيدي تليجرام للتاجر (اختياري)</label>
            <input
              value={merchantTgId}
              onChange={(e) => setMerchantTgId(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono"
              placeholder="123456789"
            />
            <p className="mt-1 text-xs text-slate-500">
              إن وُضع، فقط هذا الحساب يستطيع «متجري» وإضافة منتجات. فارغ = أي عضو (وضع اختبار). يُغيَّر لاحقاً من لوحة الإدارة.
            </p>
          </div>
        )}
        <div>
          <label className="text-sm font-bold">الترحيب</label>
          <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-bold">الأسئلة الشائعة</label>
          <textarea value={faq} onChange={(e) => setFaq(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
        </div>
        {(template.id === "store" || template.id === "clinic") && (
          <div>
            <label className="text-sm font-bold">{template.id === "clinic" ? "الخدمات (سطر لكل خدمة)" : "المنتجات (سطر لكل منتج)"}</label>
            <textarea value={products} onChange={(e) => setProducts(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
          </div>
        )}
        <button disabled={busy} className="w-full rounded-xl bg-brand-700 py-3 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "..." : "تشغيل البوت"}
        </button>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {result && <pre className="whitespace-pre-wrap rounded-xl bg-emerald-50 px-3 py-2 text-sm">{result}</pre>}
      </form>
      <div className="rounded-2xl bg-[#0e1621] p-4 text-slate-100">
        <p className="mb-3 text-center text-xs text-slate-400">معاينة</p>
        <div className="rounded-2xl bg-[#182533] p-4 text-sm">{preview}</div>
        <div className="mt-4 space-y-2">
          {template.buttons.map((row, i) => (
            <div key={i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
              {row.map((b) => (
                <div key={b} className="rounded-xl bg-[#2b5278] px-2 py-2 text-center text-xs">{b}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
