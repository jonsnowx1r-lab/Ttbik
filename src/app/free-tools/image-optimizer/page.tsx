import type { Metadata } from "next";
import ImageOptimizer from "./ImageOptimizer";

export const metadata: Metadata = {
  title: "أداة ضغط وتحويل الصور مجاناً (WebP/JPEG/PNG) | سوق تولز",
  description:
    "اضغط صورك وحوّلها إلى WebP أو JPEG أو PNG مباشرة من متصفحك، مجاناً وبلا رفع لأي خادم — خصوصية كاملة وسرعة فورية.",
};

export default function ImageOptimizerPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        🎁 أداة مجانية بالكامل — تعمل فعلياً في متصفحك
      </span>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900">ضغط وتحويل الصور</h1>
      <p className="mt-2 text-slate-600">
        ارفع صورة (PNG أو JPEG أو WebP)، اختر الصيغة والجودة، ونزّل نسخة أصغر حجماً فوراً — كل هذا يحدث بالكامل داخل
        متصفحك، دون أي رفع لصورتك إلى خادمنا أو أي خادم آخر.
      </p>
      <div className="mt-6">
        <ImageOptimizer />
      </div>
    </div>
  );
}
