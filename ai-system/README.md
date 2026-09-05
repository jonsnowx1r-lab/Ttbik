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
        ├─ RAG (rag.py) — ذاكرة شخصية + بنك معلومات مشترك يكبر تلقائياً (ChromaDB) + بحث ويب حي (ddgs)
        ├─ مجلس النماذج (council.py) — Groq (أساسي) + Gemini (رأي ثانٍ + رؤية للصور) + نموذجك المدموج (اختياري، للبرمجة) + Whisper (صوت)
        ├─ ملفات (files.py) — استخراج نص من PDF/Word (pypdf + python-docx)
        └─ الحصص/الاشتراك (quota.py) — يقرأ/يكتب في نفس مشروع Supabase
```

**القنوات المدعومة الآن:** نص، رسائل صوتية (تُفرَّغ عبر Whisper المجاني على Groq)، صور (تُحلَّل عبر Gemini)، وملفات PDF/Word (يُستخرج نصها محلياً) — الأربعة تمر عبر نفس خط المعالجة النهائي (تصنيف → سياق → مجلس النماذج)، فلا يوجد سلوك مختلف بين قناة وأخرى.

## الخطوة 1: احصل على 3 مفاتيح مجانية (من متصفح الهاتف، 5 دقائق)

| المفتاح | من أين | ماذا تفعل |
|---|---|---|
| `GROQ_API_KEY` | https://console.groq.com/keys | سجّل دخول، اضغط Create API Key |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | سجّل بحساب Google، Create API key |
| `HF_TOKEN` | https://huggingface.co/settings/tokens | أنشئ حساباً، New token بصلاحية Write |

اترك `HF_SPECIALIST_MODEL_ID` فارغاً حتى تشغّل دفتر Colab (الخطوة 4) — النظام يعمل كاملاً بدونه (Groq + Gemini فقط).

## الخطوة 2: شغّل ملفات الترحيل في Supabase

نفس مشروع Supabase الذي يستخدمه موقع سوق تولز أصلاً — افتح SQL Editor فيه، الصق محتوى `prisma/migration_19_nova_ai.sql` ثم `prisma/migration_20_nova_training_log.sql`، وشغّل كلاً منهما مرة واحدة (الثاني يضيف عمودي `message`/`answer` اللذين يُستخدمان لاحقاً كبيانات تدريب حقيقية في خطوة Kaggle).

## الخطوة 3: انشر خادم FastAPI مجاناً (Render.com)

**تحديث 2026-09-05:** كانت الخطة الأصلية تستخدم Hugging Face Spaces لاستضافة الخادم، لكن HF غيّرت سياستها — أصبح Docker/Gradio (أي أي كود بايثون حقيقي) يتطلب اشتراك PRO مدفوعاً، ويبقى مجانياً فقط SDK "Static" (صفحات HTML/JS بلا خادم، لا يصلح لـ FastAPI). لذلك ننشر الخادم على **Render.com** بدلاً من ذلك — استضافة مجانية حقيقية بلا بطاقة ائتمان، تدعم Docker مباشرة. Hugging Face يبقى مستخدَماً فقط لتخزين النموذج المدموج (Model repo، ما زال مجانياً بالكامل) في الخطوة 4.

من متصفح الهاتف:
1. أنشئ حساباً مجانياً على https://render.com (يمكن التسجيل مباشرة بحساب GitHub — لا بطاقة ائتمان مطلوبة)
2. اضغط **New +** ثم **Web Service**
3. اربطه بمستودع GitHub هذا (`Ttbik`)، وحدد **Root Directory** = `ai-system`
4. **Runtime**: اختر **Docker** (سيكتشف `ai-system/Dockerfile` تلقائياً)
5. **Instance Type**: اختر **Free**
6. من قسم **Environment Variables** أضف كل مفتاح من `.env.example` كمتغير منفصل (نفس الأسماء بالضبط)
7. اضغط **Create Web Service** — بعد اكتمال البناء (بضع دقائق)، رابط الخادم يكون شيئاً مثل: `https://nova-ai-backend.onrender.com`

**ملاحظة الخطة المجانية:** الخدمة "تنام" بعد 15 دقيقة خمول، وأول رسالة بعد نومها تأخذ حوالي 30-50 ثانية للاستيقاظ (طبيعي تماماً على الخطة المجانية) — الرسائل التالية سريعة كالمعتاد.

## الخطوة 4 (اختياري): دمج + تدريب تلقائي مُجدوَل عبر Kaggle (وليس Colab)

**لماذا Kaggle لا Colab:** دمج نموذجين بحجم 7B معاً يحتاج فعلياً حوالي
30GB ذاكرة — أُثبت هذا بتجربة مباشرة (فشل الدمج بنفاد الذاكرة على
Colab المجاني، سواء عبر GPU بسعة 15GB أو CPU RAM بسعة ~12.7GB فقط،
بغض النظر عن أي ضبط لخيارات mergekit). **Kaggle Notebooks** (مجاني
بالكامل أيضاً، بنفس حساب Google) يوفر **29GB من CPU RAM** — كافٍ عملياً.

**الإعداد لمرة واحدة فقط** (التفاصيل الكاملة داخل الدفتر نفسه، أول خلية markdown):
1. استورد `ai-system/colab/merge_and_finetune.ipynb` عبر GitHub import في Kaggle، فعّل GPU T4 وفعّل الإنترنت أيضاً من Settings -> Turn on internet (Kaggle يعطّله افتراضياً لكل دفتر جديد).
2. أضف 4 أسرار عبر **Add-ons -> Secrets**: `HF_TOKEN`، `HF_USERNAME`، `SUPABASE_URL`، `SUPABASE_SERVICE_ROLE_KEY` (بلا أي منها مكتوباً داخل الملف نفسه).
3. من قائمة الدفتر اختر **Schedule this notebook** -> **Weekly**.

من هذه اللحظة، الدمج والتدريب والرفع يحدث **تلقائياً كل أسبوع بلا أي تدخل يدوي** — الدفتر يجلب بنفسه آخر المحادثات البرمجية الحقيقية من مستخدمي Nova (عمودا `message`/`answer` في `NovaUsageLog`) ويحسّن النموذج المتخصص بها عبر LoRA، ثم يرفع النتيجة لنفس مستودعك على Hugging Face. هذا هو الشكل الصادق لـ"التحديث الذاتي" — أتمتة مُجدوَلة حقيقية عبر ميزة Kaggle نفسها، وليس شيئاً يتصرف من تلقاء نفسه خارج هذا الجدول.

**أول مرة فقط** ضع اسم النموذج الناتج (تطبعه الخلية 5) في `HF_SPECIALIST_MODEL_ID` ضمن **Environment Variables** على Render ثم اضغط **Manual Deploy**. بعدها، أي تحديث لاحق (يدوي أو مُجدوَل) يستبدل نفس المستودع تلقائياً — لا حاجة لتكرار هذه الخطوة.

## الخطوة 5: انشر واجهة Streamlit (اختياري، مجاني — Streamlit Community Cloud)

هذه استضافة Streamlit الرسمية المجانية (منفصلة عن Hugging Face تماماً، ولم تتأثر بتغيير سياسة HF):
1. من متصفح الهاتف افتح https://share.streamlit.io وسجّل دخول بحساب GitHub
2. اضغط **Create app** ثم **From existing repo**
3. اختر مستودع `Ttbik`، الفرع الصحيح، و**Main file path** = `ai-system/streamlit_app.py`
4. من **Advanced settings -> Secrets** أضف بصيغة TOML:
   ```
   NOVA_FASTAPI_URL = "https://nova-ai-backend.onrender.com"
   NOVA_INTERNAL_SECRET = "نفس القيمة الموجودة على Render"
   ```
5. اضغط **Deploy** — رابط تطبيقك يكون شيئاً مثل `https://nova-ai.streamlit.app`

## الخطوة 6: فعّل بوت Nova على تيليجرام من سوق تولز

في متغيرات بيئة Vercel لمشروع Ttbik، أضف:
- `NOVA_BOT_CREATOR_PASSWORD` — كلمة سر من اختيارك، تدخلها عند تفعيل البوت من صفحة `/bots`
- `NOVA_FASTAPI_URL` — رابط الخطوة 3
- `NOVA_INTERNAL_SECRET` — **نفس القيمة الموجودة على خادم FastAPI** (سر مشترك بين Ttbik وNova، وليس بينك وبين المستخدمين)

ثم من `/bots` على الموقع، اختر قالب "Nova AI"، أدخل التوكن وكلمة السر — يعمل البوت فوراً.

## ملاحظة الاشتراكات

لا يوجد دفع تلقائي — طلب "ترقية" يُنشئ صفاً بحالة `PENDING_APPROVAL` في جدول `NovaSubscription`، وتُفعّله أنت يدوياً (من محرر جداول Supabase: غيّر `status` إلى `ACTIVE` وحدد `startedAt`/`expiresAt`) — نفس أسلوب هذا المشروع في كل مكان آخر (لا بوابة دفع تلقائية لأي بوت).
