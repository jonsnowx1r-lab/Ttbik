"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Stats = { botsCount: number; usersCount: number; totalRevenue: number; pendingWithdrawals: number };
type PlatformAd = { id: string; platform: string; description: string | null; target: string; is_active: boolean; created_at: string };
type CreatorWithdrawal = {
  id: string;
  bot_id: string;
  amount: number;
  status: string;
  note: string | null;
  created_at: string;
  hosted_bots: { public_code: string; owner_contact: string } | null;
};

const PLATFORMS = [
  { value: "link", label: "🔗 لينك" },
  { value: "telegram", label: "📢 تلجرام" },
  { value: "youtube", label: "▶️ يوتيوب" },
  { value: "facebook", label: "📘 فيسبوك" },
  { value: "instagram", label: "📸 انستغرام" },
  { value: "twitter", label: "🐦 تويتر" },
  { value: "tiktok", label: "🎵 تيك توك" },
];

export default function AdminPlatform() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);

  const [ads, setAds] = useState<PlatformAd[]>([]);
  const [adPlatform, setAdPlatform] = useState("telegram");
  const [adTarget, setAdTarget] = useState("");
  const [adDescription, setAdDescription] = useState("");
  const [adBusy, setAdBusy] = useState(false);

  const [withdrawals, setWithdrawals] = useState<CreatorWithdrawal[]>([]);
  const [wdBusyId, setWdBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [statsRes, adsRes, wdRes] = await Promise.all([
      fetch("/api/admin/platform"),
      fetch("/api/admin/platform/ads"),
      fetch("/api/admin/platform/withdrawals"),
    ]);
    if (statsRes.ok) setStats(await statsRes.json());
    if (adsRes.ok) setAds((await adsRes.json()).ads ?? []);
    if (wdRes.ok) setWithdrawals((await wdRes.json()).withdrawals ?? []);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function sendBroadcast() {
    if (!broadcastText.trim()) return;
    setBroadcastBusy(true);
    setBroadcastMsg(null);
    const res = await fetch("/api/admin/platform/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: broadcastText }),
    });
    const data = await res.json();
    setBroadcastMsg(res.ok ? `تم الإرسال: ${data.sent} نجح، ${data.failed} فشل (عبر كل البوتات)` : data.error || "فشل");
    if (res.ok) setBroadcastText("");
    setBroadcastBusy(false);
  }

  async function addAd() {
    if (!adTarget.trim()) return;
    setAdBusy(true);
    await fetch("/api/admin/platform/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: adPlatform, target: adTarget, description: adDescription }),
    });
    setAdTarget("");
    setAdDescription("");
    setAdBusy(false);
    await loadAll();
  }

  async function toggleAd(id: string, is_active: boolean) {
    await fetch("/api/admin/platform/ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !is_active }),
    });
    await loadAll();
  }

  async function decideWithdrawal(id: string, action: "approve" | "reject") {
    setWdBusyId(id);
    await fetch("/api/admin/platform/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    await loadAll();
    setWdBusyId(null);
  }

  const pendingWd = withdrawals.filter((w) => w.status === "pending");
  const decidedWd = withdrawals.filter((w) => w.status !== "pending");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">لوحة المالك الأكبر للمنصة</h1>
        <Link href="/admin/bots" className="text-sm text-brand-700 hover:underline">
          ← البوتات المستضافة
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 text-center">
          <p className="text-2xl font-extrabold text-slate-900">{stats?.botsCount ?? "—"}</p>
          <p className="text-xs text-slate-500">بوت</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 text-center">
          <p className="text-2xl font-extrabold text-slate-900">{stats?.usersCount ?? "—"}</p>
          <p className="text-xs text-slate-500">مستخدم</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 text-center">
          <p className="text-2xl font-extrabold text-emerald-700">${stats ? stats.totalRevenue.toFixed(2) : "—"}</p>
          <p className="text-xs text-slate-500">أرباح المنصة (30% تراكمي)</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 text-center">
          <p className="text-2xl font-extrabold text-amber-700">{stats?.pendingWithdrawals ?? "—"}</p>
          <p className="text-xs text-slate-500">طلبات سحب منشئين معلَّقة</p>
        </div>
      </div>

      <section className="mb-8 rounded-2xl border bg-white p-5">
        <h2 className="mb-2 font-bold text-slate-900">📣 إذاعة لكل المستخدمين عبر كل البوتات</h2>
        <p className="mb-3 text-xs text-slate-500">يُرسَل النص لكل عضو مسجَّل في كل بوت بحالة "live". أفضل استخدام يومي واحد كحد أقصى.</p>
        <textarea
          value={broadcastText}
          onChange={(e) => setBroadcastText(e.target.value)}
          rows={3}
          placeholder="نص الرسالة..."
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={sendBroadcast}
          disabled={broadcastBusy || !broadcastText.trim()}
          className="mt-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {broadcastBusy ? "جارٍ الإرسال..." : "إرسال الآن لكل البوتات"}
        </button>
        {broadcastMsg && <p className="mt-2 text-sm">{broadcastMsg}</p>}
      </section>

      <section className="mb-8 rounded-2xl border bg-white p-5">
        <h2 className="mb-2 font-bold text-slate-900">📢 إعلانات إجبارية عبر كل البوتات</h2>
        <p className="mb-3 text-xs text-slate-500">
          تظهر بنسبة ~1 من كل 5 مشاهدات ضمن «شاهد إعلان» على المنصة المطابقة في كل بوت — عرض ترويجي مجاني بلا مكافأة (لا يوجد معلن يدفع مقابلها).
        </p>
        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          <select value={adPlatform} onChange={(e) => setAdPlatform(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            value={adTarget}
            onChange={(e) => setAdTarget(e.target.value)}
            placeholder="الرابط/الحساب"
            className="rounded-xl border px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            value={adDescription}
            onChange={(e) => setAdDescription(e.target.value)}
            placeholder="وصف مختصر (اختياري)"
            className="rounded-xl border px-3 py-2 text-sm"
          />
        </div>
        <button onClick={addAd} disabled={adBusy || !adTarget.trim()} className="mb-4 rounded-xl bg-brand-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          إضافة إعلان
        </button>
        <div className="space-y-2">
          {ads.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div>
                <span className="font-bold">{PLATFORMS.find((p) => p.value === a.platform)?.label || a.platform}</span> — {a.target}
                {a.description && <p className="text-xs text-slate-500">{a.description}</p>}
              </div>
              <button
                onClick={() => toggleAd(a.id, a.is_active)}
                className={`rounded-lg px-3 py-1 text-xs font-bold text-white ${a.is_active ? "bg-emerald-600" : "bg-slate-400"}`}
              >
                {a.is_active ? "مفعّل" : "متوقف"}
              </button>
            </div>
          ))}
          {ads.length === 0 && <p className="text-sm text-slate-500">لا إعلانات منصة بعد.</p>}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="mb-2 font-bold text-slate-900">💼 طلبات سحب عمولة منشئي البوتات</h2>
        <p className="mb-3 text-xs text-slate-500">الموافقة تسجّل القرار فقط — التحويل الفعلي (بنكي/USDT) يتم يدوياً من طرفك. الرفض يعيد المبلغ لرصيد منشئ البوت.</p>
        <div className="space-y-3">
          {pendingWd.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <div>
                <p className="font-mono text-xs text-slate-500">
                  {w.hosted_bots?.public_code} · {w.hosted_bots?.owner_contact}
                </p>
                <p className="font-bold text-slate-900">${Number(w.amount).toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => decideWithdrawal(w.id, "approve")} disabled={wdBusyId === w.id} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
                  موافقة
                </button>
                <button onClick={() => decideWithdrawal(w.id, "reject")} disabled={wdBusyId === w.id} className="rounded-xl bg-red-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
                  رفض
                </button>
              </div>
            </div>
          ))}
          {pendingWd.length === 0 && <p className="text-sm text-slate-500">لا طلبات معلَّقة.</p>}
        </div>
        {decidedWd.length > 0 && (
          <div className="mt-4 space-y-2">
            {decidedWd.map((w) => (
              <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                {w.hosted_bots?.public_code} — ${Number(w.amount).toFixed(2)} —{" "}
                <span className={w.status === "approved" ? "text-emerald-700" : "text-red-700"}>{w.status === "approved" ? "مقبول" : "مرفوض"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
