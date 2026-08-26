# بوت الرد الآلي — Auto Reply Bot

بوت تليجرام يرد تلقائياً على رسائل عملائك بناءً على كلمات مفتاحية، بدون أي تكلفة تشغيل.

## التشغيل (3 خطوات)

1. أنشئ بوتاً مجانياً عبر [@BotFather](https://t.me/BotFather) على تليجرام واحصل على التوكن.
2. عدّل ملف `replies.json` وأضف الكلمات المفتاحية وردودها كما تحتاج مشروعك.
3. شغّل البوت:
   ```bash
   export TELEGRAM_BOT_TOKEN=xxxxx:yyyyyy
   node index.js
   ```

## النشر المجاني الدائم

يعمل هذا البوت بنظام Long Polling (لا يحتاج دومين أو Webhook)، لذا يمكن نشره مجاناً على أي من:
- [Railway](https://railway.app) (Free Trial/Hobby tier)
- [Render](https://render.com) (Background Worker — Free tier)
- أي جهاز يعمل باستمرار (VPS شخصي، Raspberry Pi، ...)

## التخصيص

كل قاعدة رد في `replies.json` تحتوي على:
- `keywords`: قائمة كلمات، إذا وُجدت أي منها في رسالة العميل يتم إرسال الرد المقابل.
- `reply`: نص الرد.

أضف قواعد بلا حدود، والرد الافتراضي (`default`) يُستخدم عندما لا تُطابق أي كلمة مفتاحية.
