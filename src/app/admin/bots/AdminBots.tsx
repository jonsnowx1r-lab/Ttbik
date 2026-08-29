"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export default function AdminBots() {
  const [bots, setBots] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [broadcastOpenId, setBroadcastOpenId] = useState<string | null>(null);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/bots");
    if (res.ok) setBots((await res.json()).bots ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: string) {
    const res = await fetch(`/api/admin/bots/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setMsg(res.ok ? `تم: ${data.status}` : data.error || "فشل");
    await load();
  }

  async function sendBroadcast(id: string) {
    if (!broadcastText.trim()) return;
    setBroadcastBusy(true);
    const res = await fetch(`/api/admin/bots/${id}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: broadcastText }),
    });
    const data = await res.json();
    setMsg(res.ok ? `تم الإرسال: ${data.sent} نجح، ${data.failed} فشل من ${data.total}` : data.error || "فشل");
    if (res.ok) {
      setBroadcastText("");
      setBroadcastOpenId(null);
    }
    setBroadcastBusy(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">البوتات المستضافة</h1>
        <Link href="/bots" className="rounded-full bg-brand-700 px-3 py-1.5 text-sm text-white">إنشاء بوت</Link>
      </div>
      {msg && <p className="mb-3 text-sm">{msg}</p>}
      <div className="space-y-3">
        {bots.map((b) => (
          <div key={b.id} className="rounded-2xl border bg-white p-4">
            <p className="font-mono text-xs">{b.public_code}</p>
            <p className="font-bold">{b.bot_username || "بدون يوزر"} · {b.template_type} · {b.status}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => act(b.id, "live")} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white">تفعيل</button>
              <button onClick={() => act(b.id, "pause")} className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs text-white">إيقاف</button>
              {b.template_type === "ad-campaign" && (
                <>
                  <Link href={`/admin/bots/${b.id}/ads`} className="rounded-xl bg-brand-700 px-3 py-1.5 text-xs text-white">
                    إدارة الإعلانات
                  </Link>
                  <Link href={`/admin/bots/${b.id}/withdrawals`} className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs text-white">
                    طلبات السحب
                  </Link>
                </>
              )}
              {b.template_type === "medical" && (
                <Link href={`/admin/bots/${b.id}/facilities`} className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs text-white">
                  تسجيلات المنشآت
                </Link>
              )}
              <button
                onClick={() => setBroadcastOpenId(broadcastOpenId === b.id ? null : b.id)}
                className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs text-white"
              >
                📢 بث لكل الأعضاء
              </button>
            </div>
            {broadcastOpenId === b.id && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <textarea
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  rows={3}
                  placeholder="نص الرسالة التي ستصل لكل أعضاء هذا البوت على تيليجرام..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => sendBroadcast(b.id)}
                  disabled={broadcastBusy || !broadcastText.trim()}
                  className="mt-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {broadcastBusy ? "جارٍ الإرسال..." : "إرسال الآن"}
                </button>
              </div>
            )}
          </div>
        ))}
        {bots.length === 0 && <p className="text-slate-500">لا بوتات بعد</p>}
      </div>
    </div>
  );
}
