"use client";

import { useSearchParams } from "next/navigation";

const MODE_LABELS: Record<string, string> = {
  summarize: "ملخص التقرير",
  reviews: "تحليل التقييمات",
};

export default function ResultView() {
  const params = useSearchParams();
  const output = params.get("output") || "";
  const mode = params.get("mode") || "";

  if (!output) {
    return <p className="text-slate-500">لا توجد نتيجة — عد للأداة وجرّب مجدداً.</p>;
  }

  return (
    <div>
      {MODE_LABELS[mode] && <p className="mb-2 text-xs font-bold text-sky-700">{MODE_LABELS[mode]}</p>}
      <div className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">{output}</div>
    </div>
  );
}
