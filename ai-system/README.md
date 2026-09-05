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

## الخطوة 4 (اختياري): دمج النماذج عبر Kaggle (وليس Colab)

**لماذا Kaggle لا Colab:** دمج نموذجين بحجم 7B معاً يحتاج فعلياً حوالي
30GB ذاكرة — أُثبت هذا بتجربة مباشرة (فشل الدمج بنفاد الذاكرة على
Colab المجاني، سواء عبر GPU بسعة 15GB أو CPU RAM بسعة ~12.7GB فقط،
بغض النظر عن أي ضبط لخيارات mergekit). **Kaggle Notebooks** (مجاني
بالكامل أيضاً، بنفس حساب Google) يوفر **29GB من CPU RAM** — كافٍ عملياً.

من متصفح الهاتف:
1. أنشئ حساباً مجانياً على kaggle.com (يمكن مباشرة بحساب Google)
2. **Create** -> **New Notebook**، ثم من قائمة **File** -> **Import Notebook** -> تبويب **GitHub** -> الصق:
   `https://github.com/<owner>/<repo>/blob/<branch>/ai-system/colab/merge_and_finetune.ipynb`
3. من اللوحة اليمنى **Notebook options** -> **Accelerator** فعّل أي GPU T4 متاح (Kaggle يطلب تحقق رقم هاتف مرة واحدة لتفعيل هذا الخيار، مجاني)
4. شغّل كل خلية بالترتيب بزر ▷

في النهاية ضع اسم النموذج الناتج في `HF_SPECIALIST_MODEL_ID` ضمن **Environment Variables** على Render (وليس HF — الخادم نفسه على Render، الطراز فقط مخزَّن ومقروء من HF Hub) ثم اضغط **Manual Deploy** لإعادة تشغيل الخادم.

هذه الجلسة مجانية وتنقطع بعد خمول — شغّلها دورياً (أسبوعياً مثلاً) لتحسين النموذج المتخصص، وليست جزءاً من مسار خدمة المستخدمين اللحظي (ذاك عمل Groq/Gemini الدائمين).

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
