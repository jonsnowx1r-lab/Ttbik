"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Withdrawal = {
  id: string;
  tg_user_id: string;
  amount: number;
  status: string;
  note: string | null;
  created_at: string;
};

export default function AdminBotWithdrawals({ botId }: { botId: string }) {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/bots/${botId}/withdrawals`);
    if (res.ok) setItems((await res.json()).withdrawals ?? []);
  }, [botId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(txId: string, action: "approve" | "reject") {
    setBusyId(txId);
    const res = await fetch(`/api/admin/bots/${botId}/withdrawals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txId, action }),
    });
    const data = await res.json();
    setMsg(res.ok ? `تم: ${data.status}` : data.error || "فشل");
    await load();
    setBusyId(null);
  }

  const pending = items.filter((w) => w.status === "pending");
  const decided = items.filter((w) => w.status !== "pending");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">طلبات السحب</h1>
        <Link href="/admin/bots" className="text-sm text-brand-700 hover:underline">
          ← رجوع لقائمة البوتات
        </Link>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        الموافقة هنا تسجّل القرار فقط — تحويل المبلغ فعلياً (بنكي/USDT) يتم يدوياً من طرفك خارج الموقع. الرفض يعيد النقاط لرصيد العضو تلقائياً.
      </p>
      {msg && <p className="mb-3 text-sm">{msg}</p>}

      <h2 className="mb-2 font-bold text-slate-900">قيد المراجعة ({pending.length})</h2>
      <div className="space-y-3">
        {pending.map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div>
              <p className="font-mono text-xs text-slate-500">tg:{w.tg_user_id}</p>
              <p className="font-bold text-slate-900">{w.amount} نقطة</p>
              <p className="text-xs text-slate-500">{new Date(w.created_at).toLocaleString("ar")}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => act(w.id, "approve")}
                disabled={busyId === w.id}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                موافقة
              </button>
              <button
                onClick={() => act(w.id, "reject")}
                disabled={busyId === w.id}
                className="rounded-xl bg-red-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                رفض
              </button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="text-sm text-slate-500">لا طلبات معلَّقة.</p>}
      </div>

      {decided.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-bold text-slate-900">سابقة</h2>
          <div className="space-y-2">
            {decided.map((w) => (
              <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <span className="font-mono text-xs text-slate-500">tg:{w.tg_user_id}</span> — {w.amount} نقطة —{" "}
                <span className={w.status === "approved" ? "text-emerald-700" : "text-red-700"}>
                  {w.status === "approved" ? "مقبول" : "مرفوض"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
