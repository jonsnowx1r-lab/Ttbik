"use client";

import { useMemo, useState } from "react";
import type { BotTemplate } from "@/lib/botTemplates";

export default function BotBuilder({ template }: { template: BotTemplate }) {
  const [token, setToken] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [welcome, setWelcome] = useState(template.defaults.welcome);
  const [faq, setFaq] = useState(template.defaults.faq);
  const [products, setProducts] = useState("منتج تجريبي — 10 نقاط");
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
          welcome,
          faq,
          products: template.id === "store" ? products : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل التشغيل");
      setResult(
        `${data.message}\n${data.bot?.bot_username || ""}\nرمز البوت: ${data.bot?.public_code || ""}\nالحالة: ${data.bot?.status || ""}`
      );
    } catch (e: any) {
      setError(e.message || "خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          launch();
        }}
      >
        <div>
          <label className="text-sm font-bold text-slate-700">توكن البوت من @BotFather</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
            placeholder="123456789:AA...."
            required
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700">تواصل المالك</label>
          <input
            value={ownerContact}
            onChange={(e) => setOwnerContact(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="@username أو رقم"
            required
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700">رسالة الترحيب</label>
          <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={5} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700">الأسئلة الشائعة</label>
          <textarea value={faq} onChange={(e) => setFaq(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </div>
        {template.id === "store" && (
          <div>
            <label className="text-sm font-bold text-slate-700">المنتجات (سطر لكل منتج)</label>
            <textarea value={products} onChange={(e) => setProducts(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
        )}
        <button disabled={busy} className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? "جارٍ التشغيل..." : "تشغيل البوت على الموقع"}
        </button>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {result && <pre className="whitespace-pre-wrap rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{result}</pre>}
      </form>
      <div className="rounded-2xl border border-slate-200 bg-[#0e1621] p-4 text-slate-100 shadow-sm">
        <p className="mb-3 text-center text-xs text-slate-400">معاينة قائمة البوت</p>
        <div className="rounded-2xl bg-[#182533] p-4 text-sm leading-6">{preview}</div>
        <div className="mt-4 space-y-2">
          {template.buttons.map((row, i) => (
            <div key={i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
              {row.map((b) => (
                <div key={b} className="rounded-xl bg-[#2b5278] px-2 py-2 text-center text-xs font-semibold">{b}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
