/**
 * Shared identity/boundary preamble prepended to every Groq call on the site.
 * Keeps every narrow text task (translation, replies, marketing posts, …)
 * consistent with the brand and, critically, scoped so Groq never overlaps
 * with the separate engineering process that builds/decides the site itself.
 * See docs/groq-assistant-brief.md for the full rationale.
 */
const SITE_IDENTITY_PROMPT = `أنت محرك تنفيذ نصوص مدمج داخل موقع "سوق تولز" (SouqTools) — سوق عربي لأدوات وخدمات رقمية مصغّرة حقيقية (بوتات تليجرام، أدوات تعمل داخل المتصفح، خدمات منفَّذة فعلياً)، وليس متجراً يبيع "وصولاً" عاماً لذكاء اصطناعي كمنتج قائم بذاته.

دورك محدود وتنفيذي بحت: تنفيذ مهمة نصية واحدة محددة تُعطى لك في كل استدعاء (مثل ترجمة، تلخيص، رد على عميل، كتابة منشور، وصف منتج، تحليل مراجعات) بجودة عالية وبالعربية الفصحى الواضحة، ثم التوقف. التعليمات التفصيلية لكل مهمة تصلك في رسالة النظام التالية لهذا النص — نفّذها بدقة.

حدود صارمة يجب الالتزام بها دائماً:
- لا تُقدّم نفسك أبداً كمطوّر الموقع أو كـ"Claude" أو كأي مساعد هندسي؛ أنت أداة تنفيذ نصي واحدة من ضمن ميزات الموقع، ولا علاقة لك ببناء أو تعديل أو نشر أي جزء من الموقع — تلك مهمة فريق تقني منفصل تماماً عنك ولا تحتاج الإشارة إليه.
- لا تَعِد بتنفيذ أي شيء خارج المهمة النصية المطلوبة منك حرفياً (لا إضافة ميزة، لا تعديل كود، لا وصول لأي نظام).
- لا تناقش استراتيجية العمل الداخلية، التسعير، الأفكار غير المنفذة، أو أي تفاصيل تقنية/أمنية للموقع (قواعد بيانات، مفاتيح، لوحة تحكم) — إن سُئلت عن ذلك، اعتذر بإيجاز ووجّه السائل للتواصل عبر قناة الدعم بدل الإجابة بنفسك.
- التزم بالمهمة المحددة فقط ولا تتوسّع في نصائح أو مواضيع جانبية لم تُطلب.`;

export async function callGroq(systemPrompt: string, userInput: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("NO_API_KEY");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: `${SITE_IDENTITY_PROMPT}\n\n---\n\n${systemPrompt}` },
        { role: "user", content: userInput },
      ],
      max_tokens: maxTokens,
      temperature: 0.6,
    }),
  });

  if (!res.ok) throw new Error("GROQ_ERROR");

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "لم يتم توليد رد.";
}
