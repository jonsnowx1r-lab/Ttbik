"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  advertiser_tg_user_id: string;
  platform: string;
  sub_type: string | null;
  description: string | null;
  target: string;
  budget_total: number;
  budget_remaining: number;
  cpc: number;
  status: string;
  created_at: string;
};

const PLATFORM_LABEL: Record<string, string> = {
  link: "🔗 لينك",
  telegram: "📢 تلجرام",
  youtube: "▶️ يوتيوب",
  facebook: "📘 فيسبوك",
  instagram: "📸 انستغرام",
  twitter: "🐦 تويتر",
};

const fmt = (n: number) => `$${Number(n).toFixed(2)}`;

export default function AdminBotCampaigns({ botId }: { botId: string }) {
  const [items, setItems] = useState<Campaign[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/bots/${botId}/campaigns`);
    if (res.ok) setItems((await res.json()).campaigns ?? []);
  }, [botId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(taskId: string, action: "approve" | "reject") {
    setBusyId(taskId);
    const res = await fetch(`/api/admin/bots/${botId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, action }),
    });
    const data = await res.json();
    setMsg(res.ok ? "تم" : data.error || "فشل");
    await load();
    setBusyId(null);
  }

  const pending = items.filter((c) => c.status === "pending");
  const others = items.filter((c) => c.status !== "pending");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">مراجعة الحملات</h1>
        <Link href="/admin/bots" className="text-sm text-brand-700 hover:underline">
          ← رجوع لقائمة البوتات
        </Link>
      </div>
      <p className="mb-4 text-xs text-slate-500">الموافقة تنشر الحملة فوراً في «شاهد إعلان» لكل الأعضاء. الرفض يعيد كامل الميزانية للمعلن.</p>
      {msg && <p className="mb-3 text-sm">{msg}</p>}

      <h2 className="mb-2 font-bold text-slate-900">بانتظار المراجعة ({pending.length})</h2>
      <div className="space-y-3">
        {pending.map((c) => (
          <div key={c.id} className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-bold text-slate-900">
              {PLATFORM_LABEL[c.platform] || c.platform}
              {c.sub_type ? ` (${c.sub_type === "retweet" ? "إعادة تغريد" : "متابعة"})` : ""}: {c.target}
            </p>
            {c.description && <p className="text-xs text-slate-600">{c.description}</p>}
            <p className="text-xs text-slate-600">ميزانية {fmt(c.budget_total)} — سعر النقرة {fmt(c.cpc)}</p>
            <p className="text-xs text-slate-500">tg:{c.advertiser_tg_user_id}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => act(c.id, "approve")} disabled={busyId === c.id} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
                موافقة ونشر
              </button>
              <button onClick={() => act(c.id, "reject")} disabled={busyId === c.id} className="rounded-xl bg-red-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
                رفض وإعادة المبلغ
              </button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="text-sm text-slate-500">لا حملات معلَّقة.</p>}
      </div>

      {others.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-bold text-slate-900">سابقة</h2>
          <div className="space-y-2">
            {others.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                {PLATFORM_LABEL[c.platform] || c.platform}: {c.target} — متبقٍ {fmt(c.budget_remaining)} من {fmt(c.budget_total)} — {c.status}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
