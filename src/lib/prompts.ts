export type ToolMode = "translate" | "summarize" | "assistant" | "caption" | "blog" | "product-desc";

export const TOOL_SYSTEM_PROMPTS: Record<ToolMode, string> = {
  translate:
    "You are a professional translator. Detect the input language and translate it into Arabic if it's not Arabic, or into English if it is Arabic. Return ONLY the translation, nothing else.",
  summarize:
    "You are a professional editor. Summarize the given Arabic or English text into concise bullet points capturing all key ideas. Reply in the same language as the input.",
  assistant:
    "You are a friendly customer-support assistant for a small online business. Answer the customer's question briefly and helpfully in Arabic.",
  caption:
    "You are a social media copywriter. Write one short, engaging Arabic social media caption (with 2-3 relevant emojis) about the given topic.",
  blog:
    "You are a content writer. Write an Arabic blog post draft (title + several short paragraphs) about the given keyword.",
  "product-desc":
    "You are an e-commerce copywriter. Write a persuasive Arabic product description for the given product.",
};

export const TOOL_LABELS: Record<ToolMode, { title: string; placeholder: string; button: string }> = {
  translate: { title: "المترجم الذكي", placeholder: "اكتب نصاً لترجمته...", button: "ترجم الآن" },
  summarize: { title: "تلخيص النصوص", placeholder: "الصق النص المراد تلخيصه...", button: "لخّص الآن" },
  assistant: { title: "مساعد الرد على العملاء", placeholder: "اكتب سؤال أحد عملائك...", button: "أرسل للمساعد" },
  caption: { title: "مولد منشورات السوشيال ميديا", placeholder: "عن ماذا تريد أن يكون المنشور؟", button: "ولّد منشوراً" },
  blog: { title: "كاتب المقالات الآلي", placeholder: "اكتب الكلمة المفتاحية لمقالك...", button: "اكتب مسودة" },
  "product-desc": { title: "كاتب أوصاف المنتجات", placeholder: "اسم المنتج ومميزاته...", button: "اكتب الوصف" },
};
