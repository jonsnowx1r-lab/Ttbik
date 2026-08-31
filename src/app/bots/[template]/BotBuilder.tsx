"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BotTemplate } from "@/lib/botTemplates";

const TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

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
  const [currencyName, setCurrencyName] = useState(template.defaults.currencyName);
  const [products, setProducts] = useState(
    template.id === "clinic" ? "استشارة عامة\nفحص دوري" : "منتج تجريبي — 10 نقاط"
  );
  const [merchantTgId, setMerchantTgId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [botLink, setBotLink] = useState<string | null>(null);
  const [publicCode, setPublicCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launchedWithoutMerchant, setLaunchedWithoutMerchant] = useState(false);
  const preview = useMemo(() => welcome || template.defaults.welcome, [welcome, template.defaults.welcome]);

  async function launch() {
    setBusy(true);
    setError(null);
    setResult(null);
    setBotLink(null);
    setPublicCode(null);
    setCopied(false);
    setLaunchedWithoutMerchant(false);
    try {
      const trimmed = token.trim();
      if (!TOKEN_RE.test(trimmed)) {
        throw new Error("صيغة التوكن غير صحيحة. انسخه من @BotFather كما هو (رقم:حروف). دون مسافات أو علامات اقتباس.");
      }
      const res = await fetch("/api/bots/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: template.id,
          token: trimmed,
          ownerContact,
          orderCode,
          welcome,
          faq,
          currencyName: currencyName.trim() || template.defaults.currencyName,
          products: template.id === "store" || template.id === "clinic" ? products : "",
          merchantTgId: template.id === "store" ? merchantTgId.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.detail].filter(Boolean).join("\n") || "فشل التشغيل");
      const uname = String(data.bot?.bot_username || "").replace(/^@/, "");
      const code = String(data.bot?.public_code || "");
      setResult(`${data.message}\n${data.bot?.bot_username || ""}\nرمز البوت: ${code}`);
      if (uname) setBotLink(`https://t.me/${uname}`);
      if (code) setPublicCode(code);
      if (template.id === "store" && !merchantTgId.trim()) {
        setLaunchedWithoutMerchant(true);
      }
    } catch (e: any) {
      setError(e.message || "خطأ");
    } finally {
      setBusy(false);
    }
  }

  async function copyPublicCode() {
    if (!publicCode) return;
    try {
      await navigator.clipboard.writeText(publicCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
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
            . بدون طلب موافق لا يُشغّل البوت. يُملأ تلقائياً من ?order= في الرابط بعد الموافقة. طلب واحد = بوت واحد فقط.
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
            {merchantTgId.trim() ? (
              <p className="mt-1 text-xs text-emerald-700">
                فقط هذا الحساب يستطيع «متجري» وإضافة منتجات. يُغيَّر لاحقاً من لوحة الإدارة.
              </p>
            ) : (
              <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                بدون آيدي تاجر البوت يبقى في وضع اختبار — أي عضو يستطيع إدارة المتجر. عيّن آيدي حقيقي قبل الإطلاق العام.
              </p>
            )}
          </div>
        )}
        <div>
          <label className="text-sm font-bold">اسم العملة / الرصيد داخل البوت</label>
          <input
            value={currencyName}
            onChange={(e) => setCurrencyName(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            placeholder={template.defaults.currencyName}
            maxLength={24}
          />
          <p className="mt-1 text-xs text-slate-500">
            يظهر في رسائل الرصيد (مثال: نقطة، رصيد، $). لا يؤثر على الدفع الحقيقي من الموقع.
          </p>
        </div>
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
            <p className="mt-1 text-xs text-slate-500">
              {template.id === "clinic"
                ? "قائمة أولية تظهر في «خدماتنا». يمكن تركها فارغة أو تعديلها لاحقاً من لوحة الإدارة."
                : "قائمة أولية اختيارية — يمكن إضافة/تعديل المنتجات لاحقاً من داخل البوت بزر «متجري» (بعد تعيين آيدي التاجر)."}
            </p>
          </div>
        )}
        <button disabled={busy} className="w-full rounded-xl bg-brand-700 py-3 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "..." : "تشغيل البوت"}
        </button>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {result && (
          <div className="space-y-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
            <pre className="whitespace-pre-wrap">{result}</pre>
            {launchedWithoutMerchant && (
              <p className="rounded-lg bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
                البوت يعمل في وضع اختبار: أي عضو يستطيع إدارة المتجر. عيّن آيدي التاجر من لوحة الإدارة قبل الإطلاق العام.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {botLink && (
                <a
                  href={botLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-brand-700 px-3 py-2 text-xs font-bold text-white"
                >
                  افتح البوت على تليجرام →
                </a>
              )}
              {publicCode && (
                <button
                  type="button"
                  onClick={copyPublicCode}
                  className="rounded-lg border border-emerald-600 bg-white px-3 py-2 text-xs font-bold text-emerald-800"
                >
                  {copied ? "تم النسخ ✓" : "نسخ رمز البوت"}
                </button>
              )}
            </div>
          </div>
        )}
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
