"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod } from "@/types";

interface PaymentInfo {
  bank: {
    holder: string;
    account: string;
    routing: string;
    type: string;
    name: string;
    address: string;
  };
  usdt: { address: string; network: string };
}

function maskDigits(value: string): string {
  if (!value || value.length <= 4) return value;
  return "•".repeat(Math.max(value.length - 4, 4)) + value.slice(-4);
}

export default function OrderForm({
  serviceId,
  priceUsd,
}: {
  serviceId: string;
  priceUsd: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"payment" | "form">("payment");
  const [method, setMethod] = useState<PaymentMethod>("usdt");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    fetch("/api/payment-info")
      .then((res) => res.json())
      .then(setPayment)
      .catch(() => setPayment(null));
  }, []);

  async function submit() {
    if (!name.trim() || !contact.trim() || !reference.trim()) {
      setError("الرجاء تعبئة كل الحقول");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          customerName: name,
          customerContact: contact,
          paymentMethod: method,
          transferReference: reference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "تعذّر إرسال الطلب");
      router.push(`/order/${data.orderCode}`);
    } catch (e: any) {
      setError(e.message || "حدث خطأ غير متوقع");
      setLoading(false);
    }
  }

  const bank = payment?.bank;
  const usdt = payment?.usdt;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 font-bold text-slate-900">اطلب الآن — {priceUsd}$</h3>

      {step === "payment" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMethod("usdt")}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                method === "usdt" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300"
              }`}
            >
              USDT
            </button>
            <button
              onClick={() => setMethod("bank")}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                method === "bank" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300"
              }`}
            >
              تحويل بنكي (ACH/USD)
            </button>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            {!payment ? (
              <p className="text-slate-400">جارٍ تحميل بيانات الدفع...</p>
            ) : method === "usdt" ? (
              <>
                <p className="font-semibold text-slate-700">حوّل مبلغ {priceUsd}$ إلى عنوان USDT التالي:</p>
                <p className="mt-1 break-all font-mono text-brand-700">
                  {usdt?.address || "سيتم تزويده قريباً"}
                </p>
                <p className="mt-1 text-slate-500">الشبكة: {usdt?.network}</p>
              </>
            ) : (
              <>
                <p className="mb-2 font-semibold text-slate-700">حوّل مبلغ {priceUsd}$ إلى الحساب البنكي التالي:</p>
                <dl className="space-y-1">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">صاحب الحساب</dt>
                    <dd className="font-mono text-brand-700">{bank?.holder || "سيتم تزويده قريباً"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">رقم الحساب</dt>
                    <dd className="font-mono text-brand-700">
                      {bank?.account ? (revealed ? bank.account : maskDigits(bank.account)) : "-"}
                    </dd>
                  </div>
                  {bank?.routing && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Routing Number</dt>
                      <dd className="font-mono text-brand-700">
                        {revealed ? bank.routing : maskDigits(bank.routing)}
                      </dd>
                    </div>
                  )}
                  {bank?.type && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">نوع الحساب</dt>
                      <dd className="text-slate-700">{bank.type}</dd>
                    </div>
                  )}
                  {bank?.name && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">اسم البنك</dt>
                      <dd className="text-slate-700">{bank.name}</dd>
                    </div>
                  )}
                  {bank?.address && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">عنوان البنك</dt>
                      <dd className="text-left text-slate-700">{bank.address}</dd>
                    </div>
                  )}
                </dl>
                {!revealed && bank?.account && (
                  <button
                    onClick={() => setRevealed(true)}
                    className="mt-3 text-xs font-semibold text-brand-700 underline"
                  >
                    👁️ إظهار الرقم كاملاً
                  </button>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => setStep("form")}
            className="w-full rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
          >
            تم الدفع ✅ — متابعة
          </button>
        </div>
      )}

      {step === "form" && (
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك الكامل"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="طريقة التواصل معك (تليجرام / واتساب / إيميل)"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="اسم المُحوِّل أو رقم عملية التحويل"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setStep("payment")}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              رجوع
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="flex-1 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? "جارٍ الإرسال..." : "إرسال الطلب للمراجعة"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
