"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export default function AdminBots() {
  const [bots, setBots] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

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
                <Link href={`/admin/bots/${b.id}/ads`} className="rounded-xl bg-brand-700 px-3 py-1.5 text-xs text-white">
                  إدارة الإعلانات
                </Link>
              )}
            </div>
          </div>
        ))}
        {bots.length === 0 && <p className="text-slate-500">لا بوتات بعد</p>}
      </div>
    </div>
  );
}
