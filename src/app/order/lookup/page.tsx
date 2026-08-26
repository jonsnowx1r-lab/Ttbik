"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderLookupPage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="mb-4 text-xl font-extrabold text-slate-900">تتبّع طلبك</h1>
      <p className="mb-6 text-sm text-slate-500">أدخل رمز الطلب الذي حصلت عليه بعد الشراء (مثال: ORD-A1B2C3D4)</p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && code && router.push(`/order/${code}`)}
          placeholder="ORD-XXXXXXXX"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-center font-mono text-sm focus:border-brand-500 focus:outline-none"
        />
        <button
          onClick={() => code && router.push(`/order/${code}`)}
          className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700"
        >
          بحث
        </button>
      </div>
    </div>
  );
}
