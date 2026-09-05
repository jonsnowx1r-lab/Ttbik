# Nova AI

مساعد ذكاء اصطناعي عام، بتكلفة تشغيل $0، ثلاث واجهات (تيليجرام + ويب + API خارجي) تتصل كلها بنفس الخادم الوحيد. راجع `docs/agent-state.json` (O14) للقرار الكامل ولماذا هذه البنية بالذات.

## البنية بإيجاز

```
مستخدم (تيليجرام / Streamlit / API خارجي)
        │
        ▼
  FastAPI (ai-system/app) ← "الدماغ" الوحيد، منطق واحد لا يتكرر
        │
        ├─ MoE Router (router.py) — يصنّف السؤال محلياً بلا تكلفة
        ├─ RAG (rag.py) — ذاكرة ChromaDB + بحث ويب حي (DuckDuckGo)
        ├─ مجلس النماذج (council.py) — Groq (أساسي) + Gemini (رأي ثانٍ) + نموذجك المدموج (اختياري، للبرمجة)
        └─ الحصص/الاشتراك (quota.py) — يقرأ/يكتب في نفس مشروع Supabase
```

## الخطوة 1: احصل على 3 مفاتيح مجانية (من متصفح الهاتف، 5 دقائق)

| المفتاح | من أين | ماذا تفعل |
|---|---|---|
| `GROQ_API_KEY` | https://console.groq.com/keys | سجّل دخول، اضغط Create API Key |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | سجّل بحساب Google، Create API key |
| `HF_TOKEN` | https://huggingface.co/settings/tokens | أنشئ حساباً، New token بصلاحية Write |

اترك `HF_SPECIALIST_MODEL_ID` فارغاً حتى تشغّل دفتر Colab (الخطوة 4) — النظام يعمل كاملاً بدونه (Groq + Gemini فقط).

## الخطوة 2: شغّل migration_19_nova_ai.sql في Supabase

نفس مشروع Supabase الذي يستخدمه موقع سوق تولز أصلاً — افتح SQL Editor فيه، الصق محتوى `prisma/migration_19_nova_ai.sql`، وشغّله مرة واحدة.

## الخطوة 3: انشر خادم FastAPI مجاناً (Hugging Face Spaces)

من متصفح الهاتف:
1. افتح https://huggingface.co/new-space
2. اختر SDK = **Docker**، اسم المساحة مثلاً `nova-ai-backend`
3. من تبويب **Files**، ارفع محتوى مجلد `ai-system/` بالكامل (أو اربط الـ Space بمستودع GitHub هذا مباشرة من إعدادات الـ Space — أسهل من الهاتف)
4. أضف ملف `Dockerfile` بجذر الـ Space (انظر أسفل)
5. من تبويب **Settings -> Repository secrets** أضف كل مفتاح من `.env.example` كسر منفصل (نفس الأسماء بالضبط)
6. بعد اكتمال البناء، رابط الخادم يكون: `https://<username>-nova-ai-backend.hf.space`

**Dockerfile** (ضعه في `ai-system/Dockerfile`، هذا المشروع يحتويه بالفعل):
```
انظر ai-system/Dockerfile
```

## الخطوة 4 (اختياري): دمج النماذج عبر Colab

افتح `ai-system/colab/merge_and_finetune.ipynb` مباشرة عبر:
`https://colab.research.google.com/github/<owner>/<repo>/blob/<branch>/ai-system/colab/merge_and_finetune.ipynb`

شغّل الخلايا بالترتيب من الهاتف (Runtime -> Change runtime type -> T4 GPU، ثم ▷ على كل خلية). في النهاية ضع اسم النموذج الناتج في `HF_SPECIALIST_MODEL_ID` على HF Spaces (Repository secrets) وأعد تشغيل الـ Space.

هذه الجلسة مجانية وتنقطع بعد خمول — شغّلها دورياً (أسبوعياً مثلاً) لتحسين النموذج المتخصص، وليست جزءاً من مسار خدمة المستخدمين اللحظي (ذاك عمل Groq/Gemini الدائمين).

## الخطوة 5: انشر واجهة Streamlit (اختياري، مجاني)

نفس فكرة الخطوة 3، لكن SDK = **Streamlit** بدل Docker، والملف الرئيسي `streamlit_app.py`. أضف Secrets: `NOVA_FASTAPI_URL` (رابط الخطوة 3) و`NOVA_INTERNAL_SECRET` (نفس القيمة الموجودة على خادم FastAPI).

## الخطوة 6: فعّل بوت Nova على تيليجرام من سوق تولز

في متغيرات بيئة Vercel لمشروع Ttbik، أضف:
- `NOVA_BOT_CREATOR_PASSWORD` — كلمة سر من اختيارك، تدخلها عند تفعيل البوت من صفحة `/bots`
- `NOVA_FASTAPI_URL` — رابط الخطوة 3
- `NOVA_INTERNAL_SECRET` — **نفس القيمة الموجودة على خادم FastAPI** (سر مشترك بين Ttbik وNova، وليس بينك وبين المستخدمين)

ثم من `/bots` على الموقع، اختر قالب "Nova AI"، أدخل التوكن وكلمة السر — يعمل البوت فوراً.

## ملاحظة الاشتراكات

لا يوجد دفع تلقائي — طلب "ترقية" يُنشئ صفاً بحالة `PENDING_APPROVAL` في جدول `NovaSubscription`، وتُفعّله أنت يدوياً (من محرر جداول Supabase: غيّر `status` إلى `ACTIVE` وحدد `startedAt`/`expiresAt`) — نفس أسلوب هذا المشروع في كل مكان آخر (لا بوابة دفع تلقائية لأي بوت).
