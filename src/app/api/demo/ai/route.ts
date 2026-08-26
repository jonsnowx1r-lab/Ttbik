import { NextRequest, NextResponse } from "next/server";
import { TOOL_SYSTEM_PROMPTS, ToolMode } from "@/lib/prompts";
import { callGroq } from "@/lib/groq";

// Very small in-memory rate limiter per server instance — keeps the free
// Groq quota safe from abuse on the public, unauthenticated demo. Not
// perfectly durable across restarts, but that's fine for a public demo box.
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
  const systemPrompt = TOOL_SYSTEM_PROMPTS[mode as ToolMode];
  if (!systemPrompt || typeof input !== "string" || !input.trim()) {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  try {
    const output = await callGroq(systemPrompt, input.slice(0, 500), 300);
    return NextResponse.json({ output });
  } catch (e: any) {
    if (e.message === "NO_API_KEY") {
      return NextResponse.json(
        { error: "التجربة الحية غير مفعّلة بعد على هذا السيرفر (GROQ_API_KEY مفقود)." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "تعذّر الاتصال بمحرك الذكاء الاصطناعي المجاني الآن." }, { status: 502 });
  }
}
