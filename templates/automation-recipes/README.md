# قوالب أتمتة جاهزة — Free Automation Recipes

بديل مجاني 100% لأدوات مثل Zapier/Make، مبني على Google Apps Script
(مجاني بالكامل مع أي حساب Google) بدلاً من خدمات وسيطة مدفوعة.

## الوصفة 1 — نموذج Google Forms → إشعار تليجرام فوري

الملف: `form-to-telegram.gs`

1. أنشئ نموذج Google Forms مجاني، واربطه بجدول Google Sheets للاستجابات.
2. من الجدول: Extensions → Apps Script → الصق محتوى `form-to-telegram.gs`.
3. عدّل `TELEGRAM_BOT_TOKEN` و `TELEGRAM_CHAT_ID` في أعلى الملف.
4. من قائمة Triggers (⏰) في المحرر: أضف Trigger جديد على الدالة `onFormSubmit`
   بنوع الحدث "On form submit".

الآن كل استجابة جديدة على النموذج تصلك فوراً في تليجرام، مجاناً بالكامل.

## الوصفة 2 — تنبيه بريد إلكتروني عند تغيّر صف في Google Sheets

الملف: `sheet-change-alert.gs`

مفيد لمراقبة مخزون أو حالة طلبات في جدول بيانات، وإرسال بريد تلقائي عند أي تعديل.

## الوصفة 3 — نسخ احتياطي أسبوعي تلقائي لجدول بيانات إلى Google Drive

الملف: `weekly-backup.gs`

ينشئ نسخة PDF من الجدول كل أسبوع تلقائياً ويحفظها في مجلد محدد بـ Google Drive.

---

كل الوصفات تعمل بالكامل ضمن الحصة المجانية لـ Google Apps Script (حتى 90 دقيقة
تنفيذ يومياً للحسابات الشخصية) — أكثر من كافٍ لمعظم المشاريع الصغيرة.
