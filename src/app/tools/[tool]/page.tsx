import { notFound } from "next/navigation";
import { TOOL_LABELS, ToolMode } from "@/lib/prompts";
import { isOwnerServer } from "@/lib/isOwner";
import ToolRunner from "./ToolRunner";

export default function ToolPage({
  params,
  searchParams,
}: {
  params: { tool: string };
  searchParams: { order?: string };
}) {
  const tool = params.tool as ToolMode;
  const label = TOOL_LABELS[tool];
  if (!label) notFound();

  const isOwner = isOwnerServer();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-2 text-xl font-extrabold text-slate-900">{label.title} — النسخة الكاملة</h1>
      {isOwner ? (
        <p className="mb-6 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          🔑 وضع المالك — وصول كامل بلا رمز طلب
        </p>
      ) : (
        <p className="mb-6 text-sm text-slate-500">بدون حد للأحرف. هذه الصفحة مخصصة لحاملي الطلبات المعتمدة فقط.</p>
      )}
      <ToolRunner
        tool={tool}
        initialOrderCode={searchParams.order || ""}
        placeholder={label.placeholder}
        buttonLabel={label.button}
        isOwner={isOwner}
      />
    </div>
  );
}
