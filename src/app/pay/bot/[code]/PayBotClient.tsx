"use client";

import { useState } from "react";

export default function PayBotClient({
  code,
  uid,
  cryptoAvailable,
  justPaid,
}: {
  code: string;
  uid: string;
  cryptoAvailable: boolean;
  justPaid: boolean;
}) {
  const [amount, setAmount] = useState("10");
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState("bank");
  const [msg, setMsg] = useState<string | null>(null);
  const [cryptoBusy, setCryptoBusy] = useState(false);
  const [cryptoMsg, setCryptoMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const res = await fetch("/api/bots/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicCode: code, uid, kind: "deposit", amount: Number(amount), reference, method }),
    });
    const data = await res.json();
    setMsg(res.ok ? "تم إرسال طلب شراء النقاط للمراجعة. لن يتم سحب نقدي من البوت." : data.error || "فشل");
  }

  async function payCrypto() {
    setCryptoMsg(null);
    setCryptoBusy(true);
    const res = await fetch("/api/payments/nowpayments/create-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicCode: code, uid, amount: Number(amount) }),
    });
    const data = await res.json();
    if (res.ok && data.invoiceUrl) {
      window.location.href = data.invoiceUrl;
    } else {
      setCryptoMsg(data.error || "فشل إنشاء فاتورة الدفع");
      setCryptoBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-extrabold text-slate-900">شراء رصيد عبر الموقع</h1>
      {justPaid && (
        <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          تم استلام دفعتك. قد يستغرق ظهور الرصيد داخل البوت دقيقة لتأكيد الشبكة.
        </p>
      )}
      <p className="mt-2 text-sm text-slate-600">
        رمز البوت {code}. حدد المبلغ أدناه ثم اختر طريقة الدفع.
      </p>
      <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <label className="text-sm font-bold text-slate-700">المبلغ (بالدولار)</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" type="number" min={1} />

        {cryptoAvailable && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3">
            <p className="mb-2 text-xs font-bold text-emerald-900">💳 دفع فوري بعملة رقمية (USDT, TRX, TON, LTC, SOL...)</p>
            <p className="mb-2 text-xs text-emerald-800">تلقائي بالكامل — الرصيد يُضاف فور تأكيد الدفع، بلا مراجعة يدوية.</p>
            <button
              onClick={payCrypto}
              disabled={cryptoBusy || !Number(amount)}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {cryptoBusy ? "جارٍ التحويل..." : "الدفع بعملة رقمية →"}
            </button>
            {cryptoMsg && <p className="mt-2 text-xs text-red-700">{cryptoMsg}</p>}
          </div>
        )}

        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">تحويل يدوي (بنكي / USDT بمرجع تحويل)</summary>
          <div className="mt-3 space-y-3">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
              <option value="bank">تحويل بنكي</option>
              <option value="usdt">USDT</option>
            </select>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="مرجع التحويل" />
            <button onClick={submit} className="w-full rounded-xl bg-brand-700 py-3 text-sm font-bold text-white">
              إرسال طلب الشراء (يُراجَع يدوياً)
            </button>
            {msg && <p className="text-sm text-slate-700">{msg}</p>}
          </div>
        </details>
      </div>
    </div>
  );
}
