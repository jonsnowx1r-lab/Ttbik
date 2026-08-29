"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Facility = {
  id: string;
  name: string;
  facility_type: string;
  city_text: string | null;
  owner_tg_user_id: string;
  license_number: string | null;
  verification_status: string;
  created_at: string;
  locations: { name: string } | { name: string }[] | null;
};

const TYPE_LABEL: Record<string, string> = {
  pharmacy: "صيدلية",
  hospital: "مشفى",
  clinic: "مستوصف",
  medical_point: "نقطة طبية",
};

export default function AdminBotFacilities({ botId }: { botId: string }) {
  const [items, setItems] = useState<Facility[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/bots/${botId}/facilities`);
    if (res.ok) setItems((await res.json()).facilities ?? []);
  }, [botId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(facilityId: string, action: "verify" | "reject") {
    setBusyId(facilityId);
    const res = await fetch(`/api/admin/bots/${botId}/facilities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId, action }),
    });
    const data = await res.json();
    setMsg(res.ok ? "تم" : data.error || "فشل");
    await load();
    setBusyId(null);
  }

  const govName = (f: Facility) => (Array.isArray(f.locations) ? f.locations[0]?.name : f.locations?.name) || "—";
  const pending = items.filter((f) => f.verification_status === "pending");
  const decided = items.filter((f) => f.verification_status !== "pending");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">تسجيلات المنشآت الطبية</h1>
        <Link href="/admin/bots" className="text-sm text-brand-700 hover:underline">
          ← رجوع لقائمة البوتات
        </Link>
      </div>
      {msg && <p className="mb-3 text-sm">{msg}</p>}

      <h2 className="mb-2 font-bold text-slate-900">بانتظار المراجعة ({pending.length})</h2>
      <div className="space-y-3">
        {pending.map((f) => (
          <div key={f.id} className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-bold text-slate-900">{TYPE_LABEL[f.facility_type] || f.facility_type} — {f.name}</p>
            <p className="text-xs text-slate-600">{govName(f)}{f.city_text ? ` — ${f.city_text}` : ""} · رقم الترخيص: {f.license_number || "—"}</p>
            <p className="text-xs text-slate-500">tg:{f.owner_tg_user_id}</p>
            <div className="mt-2 flex gap-2">
              <a
                href={`/api/admin/bots/${botId}/facilities/${f.id}/photo`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs text-white"
              >
                عرض صورة الترخيص
              </a>
              <button
                onClick={() => act(f.id, "verify")}
                disabled={busyId === f.id}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                توثيق
              </button>
              <button
                onClick={() => act(f.id, "reject")}
                disabled={busyId === f.id}
                className="rounded-xl bg-red-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                رفض
              </button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="text-sm text-slate-500">لا تسجيلات معلَّقة.</p>}
      </div>

      {decided.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-bold text-slate-900">سابقة</h2>
          <div className="space-y-2">
            {decided.map((f) => (
              <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                {TYPE_LABEL[f.facility_type] || f.facility_type} — {f.name} —{" "}
                <span className={f.verification_status === "verified" ? "text-emerald-700" : "text-red-700"}>
                  {f.verification_status === "verified" ? "موثَّقة" : "مرفوضة"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
