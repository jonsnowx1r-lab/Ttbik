"use client";

import { useSearchParams } from "next/navigation";

export default function ResultView() {
  const params = useSearchParams();
  const output = params.get("output") || "";

  if (!output) {
    return <p className="text-slate-500">لا توجد نتيجة — عد للأداة وجرّب مجدداً.</p>;
  }

  return <div className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">{output}</div>;
}
