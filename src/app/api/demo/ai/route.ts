import { NextRequest, NextResponse } from "next/server";

const PROMPTS: Record<string, string> = {
  translate:
    "You are a professional translator. Detect the input language and translate it into Arabic if it's not Arabic, or into English if it is Arabic. Return ONLY the translation, nothing else.",
  summarize:
    "You are a professional editor. Summarize the given Arabic or English text into at most 5 concise bullet points. Reply in the same language as the input.",
  assistant:
    "You are a friendly customer-support assistant for a small online business. Answer the customer's question briefly and helpfully in Arabic.",
  caption:
    "You are a social media copywriter. Write one short, engaging Arabic social media caption (with 2-3 relevant emojis) about the given topic.",
  blog:
    "You are a content writer. Write a short Arabic blog post draft (title + 3 short paragraphs) about the given keyword.",
  "product-desc":
    "You are an e-commerce copywriter. Write a persuasive Arabic product description (max 80 words) for the given product.",
};

// Very small in-memory rate limiter per server instance — keeps the free
// Groq quota safe from abuse. Not perfectly durable across restarts, but
// that's fine for a public demo box.
const hits = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 15;
const WINDOW_MS = 10 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "لقد تجاوزت حد التجربة المجانية مؤقتاً، حاول لاحقاً." },
      { status: 429 }
    );
  }

  const { mode, input } = await req.json().catch(() => ({}));
  const systemPrompt = PROMPTS[mode];
  if (!systemPrompt || typeof input !== "string" || !input.trim()) {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "التجربة الحية غير مفعّلة بعد على هذا السيرفر (GROQ_API_KEY مفقود)." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.slice(0, 500) },
        ],
        max_tokens: 300,
        temperature: 0.6,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "تعذّر الاتصال بمحرك الذكاء الاصطناعي المجاني الآن." }, { status: 502 });
    }

    const data = await res.json();
    const output = data?.choices?.[0]?.message?.content?.trim() || "لم يتم توليد رد.";
    return NextResponse.json({ output });
  } catch {
    return NextResponse.json({ error: "حدث خطأ أثناء تشغيل التجربة." }, { status: 500 });
  }
}
