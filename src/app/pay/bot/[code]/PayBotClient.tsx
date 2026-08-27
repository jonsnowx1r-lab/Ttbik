"use client";

import { useState } from "react";

export default function PayBotClient({
  code,
  kind,
  uid,
}: {
  code: string;
  kind: "deposit" | "withdraw";
  uid: string;
}) {
  const [amount, setAmount] = useState("10");
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState("bank");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const res = await fetch("/api/bots/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicCode: code, uid, kind, amount: Number(amount), reference, method }),
    });
    const data = await res.json();
    setMsg(res.ok ? "تم إرسال الطلب للمراجعة في لوحة الموقع" : data.error || "فشل");
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-extrabold text-slate-900">
        {kind === "deposit" ? "إيداع نقاط عبر الموقع" : "طلب سحب نقاط"}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        رمز البوت {code}. هذا الرابط مولَّد من سوق تولز ويربط رصيد البوت بعملية دفع حقيقية بعد موافقة المالك.
      </p>
      <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" type="number" min={1} />
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
          <option value="bank">تحويل بنكي</option>
          <option value="usdt">USDT</option>
        </select>
        <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="مرجع التحويل أو ملاحظة السحب" />
        <button onClick={submit} className="w-full rounded-xl bg-brand-700 py-3 text-sm font-bold text-white">
          إرسال للمراجعة
        </button>
        {msg && <p className="text-sm text-slate-700">{msg}</p>}
      </div>
    </div>
  );
}
