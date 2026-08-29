"use client";

import { useState } from "react";

export default function AdCard({
  publicCode,
  uid,
  ad,
}: {
  publicCode: string;
  uid: string;
  ad: { id: string; title: string; reward_points: number; alreadyViewed: boolean; channel_username?: string | null };
}) {
  const [claimed, setClaimed] = useState(ad.alreadyViewed);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function claim() {
    if (!uid) {
      setMsg("افتح هذه الصفحة من داخل البوت (زر «الإعلانات») حتى يُعرف حسابك.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/bots/ads/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicCode, uid, adId: ad.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر الاحتساب");
      setClaimed(true);
      setMsg(`تمت إضافة ${data.awarded} نقطة! رصيدك الآن ${data.balance}.`);
    } catch (e: any) {
      setMsg(e.message || "خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-900">{ad.title}</h2>
      <p className="mt-1 text-sm text-brand-700">مكافأة المشاهدة: {ad.reward_points} نقطة</p>
      {ad.channel_username && (
        <a
          href={`https://t.me/${ad.channel_username.replace(/^@/, "")}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-bold text-indigo-600 underline"
        >
          1) انضم أولاً إلى @{ad.channel_username.replace(/^@/, "")}
        </a>
      )}
      <button
        onClick={claim}
        disabled={claimed || busy}
        className="mt-4 w-full rounded-xl bg-brand-700 py-2.5 text-sm font-bold text-white disabled:bg-slate-300"
      >
        {claimed
          ? "✅ تمت المشاهدة والاحتساب"
          : busy
            ? "جارٍ الاحتساب..."
            : ad.channel_username
              ? "2) انضممت — احصل على النقاط"
              : "شاهدت الإعلان — احصل على النقاط"}
      </button>
      {msg && <p className="mt-2 text-xs text-slate-600">{msg}</p>}
    </div>
  );
}
