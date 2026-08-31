"use client";

import { useEffect, useRef, useState } from "react";

type ClickData = { ok: true; verified: boolean; issuedAt: string; requiredSeconds: number; targetUrl: string };

export default function WatchClient({ token }: { token: string }) {
  const [data, setData] = useState<ClickData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const openedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/watch/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.ok) {
          setLoadError(d.error || "تعذّر تحميل الصفحة.");
          return;
        }
        setData(d);
        if (d.verified) setConfirmed(true);
      })
      .catch(() => !cancelled && setLoadError("تعذّر الاتصال بالخادم."));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!data || confirmed) return;
    if (!openedRef.current) {
      openedRef.current = true;
      window.open(data.targetUrl, "_blank", "noopener,noreferrer");
    }
    const issuedAt = new Date(data.issuedAt).getTime();
    const requiredMs = data.requiredSeconds * 1000;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((issuedAt + requiredMs - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [data, confirmed]);

  async function confirm() {
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/watch/${token}/complete`, { method: "POST" });
      const d = await res.json();
      if (d.ok) {
        setConfirmed(true);
      } else {
        setConfirmError(d.error || "لم يمر الوقت المطلوب بعد.");
      }
    } catch {
      setConfirmError("تعذّر الاتصال بالخادم.");
    } finally {
      setConfirming(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center" dir="rtl">
        <p className="text-red-700">{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-slate-500" dir="rtl">
        جارِ التحميل...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12" dir="rtl">
      <h1 className="text-2xl font-extrabold text-slate-900">شاهد واربح</h1>
      <p className="mt-2 text-sm text-slate-600">تم فتح الرابط في نافذة جديدة — أكمل الإجراء المطلوب هناك، ثم عد إلى هذه الصفحة.</p>
      <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-center">
        {confirmed ? (
          <p className="text-lg font-bold text-emerald-700">✅ تم! ارجع الآن إلى البوت واضغط «✅ تحقق من الإنجاز».</p>
        ) : (
          <>
            <p className="text-3xl font-extrabold text-brand-700">{secondsLeft ?? data.requiredSeconds}</p>
            <p className="text-sm text-slate-500">ثانية متبقية قبل تفعيل زر المتابعة</p>
            <a href={data.targetUrl} target="_blank" rel="noopener noreferrer" className="block text-sm text-brand-700 underline">
              فتح الرابط مرة أخرى
            </a>
            <button
              onClick={confirm}
              disabled={confirming || (secondsLeft ?? 1) > 0}
              className="w-full rounded-xl bg-brand-700 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {confirming ? "جارٍ التأكيد..." : "متابعة ✅"}
            </button>
            {confirmError && <p className="text-sm text-red-700">{confirmError}</p>}
          </>
        )}
      </div>
    </div>
  );
}
