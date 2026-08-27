import { notFound } from "next/navigation";
import { getBotTemplate } from "@/lib/botTemplates";
import BotBuilder from "./BotBuilder";

export default function BotTemplatePage({ params }: { params: { template: string } }) {
  const template = getBotTemplate(params.template);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-xs font-bold text-brand-700">قالب عامل — ليس ملف تحميل</p>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">
        {template.icon} {template.name}
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">{template.desc}</p>
      <div className="mt-8">
        <BotBuilder template={template} />
      </div>
    </div>
  );
}
