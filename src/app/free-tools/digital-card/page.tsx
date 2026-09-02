import type { Metadata } from "next";
import DigitalCardForm from "./DigitalCardForm";

export const metadata: Metadata = {
  title: "بطاقة أعمال رقمية (Linktree) | أدوات مجانية | سوق تولز",
  description:
    "أنشئ صفحة روابط واحدة بنمط Linktree مجاناً — عنوان، نبذة، صورة، وروابط بأزرار. عداد مشاهدات حقيقي.",
};

export default function DigitalCardPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-extrabold text-slate-900">بطاقة أعمال رقمية</h1>
      <p className="mt-2 text-slate-600">
        صفحة واحدة بنمط Linktree: اسمك، نبذة، صورة اختيارية، وقائمة روابط بأزرار. مجانية بالكامل
        وبلا تسجيل.
      </p>
      <div className="mt-8">
        <DigitalCardForm />
      </div>
    </div>
  );
}
