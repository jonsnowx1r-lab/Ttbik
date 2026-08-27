import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "كيف يعمل الموقع؟ | سوق تولز",
  description: "شرح كامل لطريقة الطلب والدفع والحصول على أدواتك وبوتاتك خطوة بخطوة.",
};

const STEPS = [
  {
    title: "١. اختر خدمة أو أداة",
    body: "تصفّح الأقسام من الصفحة الرئيسية، أو افتح /bots لإنشاء بوت تليجرام مستضاف، أو /free-tools للأدوات المجانية بلا طلب ولا دفع إطلاقاً.",
  },
  {
    title: "٢. أرسل الطلب",
    body: "في صفحة أي خدمة مدفوعة اضغط زر الطلب، واملأ بياناتك (الاسم ووسيلة التواصل). سيظهر لك فوراً رمز طلب فريد بصيغة ORD-XXXXXXXX — احفظه، فهو مفتاحك لكل شيء لاحقاً.",
  },
  {
    title: "٣. ادفع",
    body: "حوّل المبلغ عبر التحويل البنكي أو USDT إلى البيانات الظاهرة في صفحة الطلب، ثم أدخل رقم/مرجع التحويل في نموذج الطلب نفسه كإثبات دفع.",
  },
  {
    title: "٤. انتظر الموافقة",
    body: "يراجع مالك الموقع طلبك يدوياً (عادة خلال ساعات قليلة) بعد التأكد من التحويل، من لوحة التحكم الخاصة به. تابع حالة طلبك في أي وقت من صفحة «تتبع طلبي» بإدخال رمز الطلب.",
  },
  {
    title: "٥. استلم وصولك",
    body: "بمجرد الموافقة، تتحول حالة طلبك إلى «معتمد» وتظهر لك فوراً في نفس صفحة التتبع طريقة الاستلام حسب نوع الخدمة: رابط أداة تعمل داخل المتصفح بلا حدود، أو ملف/رابط تسليم، أو — لخدمة إنشاء البوت المستضاف تحديداً — رمز الطلب نفسه أصبح جاهزاً لاستخدامه في صفحة /bots.",
  },
];

const BOT_FAQ = [
  {
    q: "من أين أحصل على «رمز الطلب المعتمد» في صفحة إنشاء البوت؟",
    a: "هو نفس الرمز (ORD-XXXXXXXX) الذي حصلت عليه عند إرسال طلبك لخدمة «إنشاء بوت مستضاف بقالب جاهز»، بعد أن يوافق عليه المالك. لا يمكن اختراعه أو تخمينه — إدخال رمز عشوائي سيُرفض دائماً.",
  },
  {
    q: "هل استخدام الرمز مرة يعني أن أحداً آخر يملك بوتي؟",
    a: "لا. رمز الطلب هو فقط بوابة دفع تسمح لك بإنشاء بوت واحد مرة واحدة — بعدها لا يمكن إعادة استخدامه لإنشاء بوت آخر. توكن البوت نفسه (من BotFather) يبقى ملكك أنت وحدك دائماً؛ الموقع لا يحتفظ بأي صلاحية عليه بعد التفعيل.",
  },
  {
    q: "توكن BotFather من أين؟",
    a: "من تطبيق تليجرام، ابحث عن @BotFather، أرسل /newbot واتبع التعليمات، وسيعطيك سطراً بصيغة 123456789:AA...— هذا هو التوكن.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-extrabold text-slate-900">كيف يعمل الموقع؟</h1>
      <p className="mt-2 text-slate-600">
        شرح مباشر لكل خطوة، من اختيار الخدمة حتى استلام وصولك الكامل — بلا غموض.
      </p>

      <div className="mt-8 space-y-6">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold text-brand-700">{s.title}</h2>
            <p className="mt-1.5 text-sm text-slate-600">{s.body}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-extrabold text-slate-900">أسئلة خاصة بمنشئ البوتات المستضافة</h2>
      <div className="mt-4 space-y-4">
        {BOT_FAQ.map((f) => (
          <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-bold text-slate-900">{f.q}</h3>
            <p className="mt-1.5 text-sm text-slate-600">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/#categories" className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-800">
          تصفّح الخدمات
        </Link>
        <Link href="/order/lookup" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
          تتبع طلبي
        </Link>
      </div>
    </div>
  );
}
