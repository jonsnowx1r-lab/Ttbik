"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Ad = { id: string; title: string; reward_points: number; is_active: boolean };

export default function AdminBotAds({ botId }: { botId: string }) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [title, setTitle] = useState("");
  const [rewardPoints, setRewardPoints] = useState("5");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/bots/${botId}/ads`);
    if (res.ok) setAds((await res.json()).ads ?? []);
  }, [botId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addAd() {
    if (!title.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/bots/${botId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, rewardPoints: Number(rewardPoints) }),
    });
    const data = await res.json();
    setMsg(res.ok ? "أُضيف الإعلان" : data.error || "فشل");
    if (res.ok) {
      setTitle("");
      setRewardPoints("5");
      await load();
    }
    setBusy(false);
  }

  async function act(adId: string, action: "toggle" | "delete") {
    await fetch(`/api/admin/bots/${botId}/ads/${adId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">إدارة إعلانات البوت</h1>
        <Link href="/admin/bots" className="text-sm text-brand-700 hover:underline">
          ← رجوع لقائمة البوتات
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-bold text-slate-900">إضافة إعلان جديد</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان/وصف الإعلان"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={rewardPoints}
            onChange={(e) => setRewardPoints(e.target.value)}
            type="number"
            min={1}
            placeholder="النقاط"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={addAd}
            disabled={busy || !title.trim()}
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            إضافة
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
      </div>

      <div className="mt-6 space-y-3">
        {ads.map((ad) => (
          <div key={ad.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-bold text-slate-900">{ad.title}</p>
              <p className="text-xs text-slate-500">
                {ad.reward_points} نقطة · {ad.is_active ? "🟢 نشط" : "⚪ متوقف"}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => act(ad.id, "toggle")} className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs text-white">
                {ad.is_active ? "إيقاف" : "تفعيل"}
              </button>
              <button onClick={() => act(ad.id, "delete")} className="rounded-xl bg-red-600 px-3 py-1.5 text-xs text-white">
                حذف
              </button>
            </div>
          </div>
        ))}
        {ads.length === 0 && <p className="text-sm text-slate-500">لا إعلانات بعد — أضف واحداً أعلاه.</p>}
      </div>
    </div>
  );
}
