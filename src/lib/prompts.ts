export type ToolMode =
  | "translate"
  | "summarize"
  | "assistant"
  | "caption"
  | "blog"
  | "product-desc"
  | "review-analyzer";

export const TOOL_SYSTEM_PROMPTS: Record<ToolMode, string> = {
  translate:
    "You are a professional business translator specializing in commercial documents (contracts, invoices, business emails, official letters). Detect the input language and translate it into Arabic if it's not Arabic, or into English if it is Arabic. Preserve the original structure exactly (line breaks, numbered/bulleted items, headers, amounts). Use precise, formal business terminology, not casual phrasing. Return ONLY the translation, nothing else.",
  summarize:
    "You are a business analyst reviewing a report or document for a busy manager. Output exactly two sections: '📌 أهم النقاط' as 3-5 concise bullet points capturing the key facts/numbers, then '✅ التوصية المقترحة' as one single actionable recommendation sentence. Reply in the same language as the input. Be concise and business-oriented, not a generic summary.",
  assistant:
    "You are a friendly customer-support assistant for a small online business. Answer the customer's question briefly and helpfully in Arabic.",
  caption:
    "You are a social media copywriter. Write one short, engaging Arabic social media caption (with 2-3 relevant emojis) about the given topic.",
  blog:
    "You are a content writer. Write an Arabic blog post draft (title + several short paragraphs) about the given keyword.",
  "product-desc":
    "You are an e-commerce copywriter. Write a persuasive Arabic product description for the given product.",
  "review-analyzer":
    "You are a customer feedback analyst for an Arabic-speaking business. The user will paste multiple customer reviews, one per line, possibly in Arabic or English. For EACH review, on its own numbered line, output in this exact format: '<number>. التصنيف: <إيجابي|سلبي|محايد> — الرد المقترح: <one short, polite Arabic reply the business owner can send back>'. Process every line as a separate review, in the same order as given. Do not add any extra commentary before or after the list.",
};

export const TOOL_LABELS: Record<ToolMode, { title: string; placeholder: string; button: string }> = {
  translate: {
    title: "مترجم المستندات التجارية",
    placeholder: "الصق نص عقد أو فاتورة أو رسالة عمل لترجمتها مع الحفاظ على تنسيقها...",
    button: "ترجم المستند",
  },
  summarize: {
    title: "محلل التقارير والمستندات",
    placeholder: "الصق تقريراً أو مستنداً طويلاً للحصول على أهم نقاطه وتوصية عملية...",
    button: "حلّل التقرير",
  },
  assistant: { title: "مساعد الرد على العملاء", placeholder: "اكتب سؤال أحد عملائك...", button: "أرسل للمساعد" },
  caption: { title: "مولد منشورات السوشيال ميديا", placeholder: "عن ماذا تريد أن يكون المنشور؟", button: "ولّد منشوراً" },
  blog: { title: "كاتب المقالات الآلي", placeholder: "اكتب الكلمة المفتاحية لمقالك...", button: "اكتب مسودة" },
  "product-desc": { title: "كاتب أوصاف المنتجات", placeholder: "اسم المنتج ومميزاته...", button: "اكتب الوصف" },
  "review-analyzer": {
    title: "محلل آراء العملاء بالجملة",
    placeholder: "الصق آراء عملائك هنا، رأياً واحداً في كل سطر...",
    button: "حلّل كل الآراء الآن",
  },
};
