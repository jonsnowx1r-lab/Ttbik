export type BotTemplateId = "ad-campaign" | "store" | "clinic";

export interface BotTemplate {
  id: BotTemplateId;
  name: string;
  tagline: string;
  desc: string;
  icon: string;
  color: string;
  buttons: string[][];
  defaults: {
    welcome: string;
    currencyName: string;
    faq: string;
    extra: Record<string, string>;
  };
}

export const BOT_TEMPLATES: BotTemplate[] = [
  {
    id: "ad-campaign",
    name: "منشئ بوت الحملات الإعلانية",
    tagline: "نقاط + إعلانات + محفظة إيداع فقط",
    desc: "بوت عامل لجمهورك: مشاهدة حملات، رصيد نقاط، إحالات، ومسابقات. الإيداع عبر رابط من موقعك. لا يوجد سحب نقدي — النقاط داخل البوت فقط.",
    icon: "📢",
    color: "from-indigo-500 to-violet-600",
    buttons: [
      ["الإعلانات", "الأرباح"],
      ["الرصيد", "الإعدادات"],
      ["الإحالات", "المسابقات"],
      ["الأسئلة الشائعة"],
    ],
    defaults: {
      welcome:
        "أهلاً بك. هذا بوت الحملات الرسمي.\nشاهد الإعلانات المعتمدة، اجمع النقاط، واطلب إيداعاً عبر رابط يصدر من الموقع.\nلا يوجد سحب نقدي — النقاط للاستخدام داخل البوت فقط.",
      currencyName: "نقطة",
      faq: "النقاط رصيد داخلي لهذه القناة فقط.\nالإيداع يتم عبر صفحة دفع على موقع سوق تولز بعد توليد رابط خاص بك.\nلا يوجد سحب نقدي ولا وعد بأرباح أو عملة رقمية تلقائية.",
      extra: {
        contest: "لا توجد مسابقة مفتوحة حالياً. سيظهر الإعلان هنا عند إطلاقها من لوحة التحكم.",
      },
    },
  },
  {
    id: "store",
    name: "منشئ بوت المتجر",
    tagline: "منتجات + طلبات + رصيد عميل",
    desc: "كتالوج داخل تليجرام مع زر طلب. كل طلب يُسجَّل في الموقع، والدفع عبر رابط إيداع مولَّد من سوق تولز.",
    icon: "🛒",
    color: "from-amber-500 to-orange-600",
    buttons: [["المنتجات", "طلباتي"], ["الرصيد", "الدعم"], ["الأسئلة الشائعة"]],
    defaults: {
      welcome: "أهلاً بك في المتجر. تصفّح المنتجات وأتمّ الطلب من هنا، والدفع يتم برابط آمن من الموقع.",
      currencyName: "رصيد",
      faq: "الطلب يُحفظ في لوحة المتجر. بعد التحويل البنكي أو USDT من رابط الإيداع تتم إضافة الرصيد أو تأكيد الطلب.",
      extra: {
        support: "راسل مالك المتجر من خلال وسيلة التواصل المعروضة في الموقع، أو أعد إرسال رقم طلبك هنا.",
      },
    },
  },
  {
    id: "clinic",
    name: "منشئ بوت العيادة / الصيدلية",
    tagline: "حجز مواعيد + خدمات + تأكيد",
    desc: "حجز موعد بخطوات داخل البوت، مع قائمة خدمات وأوقات. التأكيد يظهر في لوحة الموقع.",
    icon: "🩺",
    color: "from-emerald-500 to-teal-600",
    buttons: [["حجز موعد", "مواعيدي"], ["خدماتنا", "التواصل"], ["الأسئلة الشائعة"]],
    defaults: {
      welcome: "أهلاً بك. احجز موعدك من الزر أدناه، وستصلك حالة التأكيد هنا وفي صفحة التتبع.",
      currencyName: "رصيد",
      faq: "الحجز لا يُعتبر مؤكداً حتى يظهر في حالة «مؤكد» من لوحة العيادة.\nيمكنك إلغاء الموعد قبل التأكيد.",
      extra: {
        hours: "السبت–الخميس · 10 صباحاً إلى 6 مساءً",
        contact: "للتواصل العاجل استخدم رقم العيادة المعتمد لدى المالك.",
      },
    },
  },
];

export function getBotTemplate(id: string | undefined | null) {
  return BOT_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function replyKeyboard(template: BotTemplate) {
  return {
    keyboard: template.buttons.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
  };
}
