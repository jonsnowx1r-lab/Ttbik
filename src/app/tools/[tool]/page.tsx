import { notFound } from "next/navigation";
import { TOOL_LABELS, ToolMode } from "@/lib/prompts";
import { STUDIO_TOOL_LABELS } from "@/lib/studioTools";
import { isOwnerServer } from "@/lib/isOwner";
import ToolRunner from "./ToolRunner";
import StudioGate from "./StudioGate";
import AudioVisualizerStudio from "@/components/studio/AudioVisualizerStudio";

const STUDIO_COMPONENTS: Record<string, React.ComponentType> = {
  "audio-visualizer": AudioVisualizerStudio,
};

export default function ToolPage({
  params,
  searchParams,
}: {
  params: { tool: string };
  searchParams: { order?: string };
}) {
  const isOwner = isOwnerServer();
  const studioLabel = STUDIO_TOOL_LABELS[params.tool];

  if (studioLabel) {
    const StudioComponent = STUDIO_COMPONENTS[params.tool];
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-2 text-xl font-extrabold text-slate-900">{studioLabel.title} — النسخة الكاملة</h1>
        {isOwner ? (
          <p className="mb-6 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            🔑 وضع المالك — وصول كامل بلا رمز طلب
          </p>
        ) : (
          <p className="mb-6 text-sm text-slate-500">هذه الصفحة مخصصة لحاملي الطلبات المعتمدة فقط.</p>
        )}
        <StudioGate tool={params.tool} initialOrderCode={searchParams.order || ""} isOwner={isOwner}>
          <StudioComponent />
        </StudioGate>
      </div>
    );
  }

  const tool = params.tool as ToolMode;
  const label = TOOL_LABELS[tool];
  if (!label) notFound();

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
