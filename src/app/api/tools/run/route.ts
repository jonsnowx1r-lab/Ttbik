import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { TOOL_SYSTEM_PROMPTS, ToolMode } from "@/lib/prompts";
import { callGroq } from "@/lib/groq";
import { isOwnerRequest } from "@/lib/isOwner";

// Per-order daily rate limit (generous — this is a paying customer, but we
// still protect the shared free Groq quota from a leaked/shared link).
const hits = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 60;
const WINDOW_MS = 24 * 60 * 60 * 1000;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

export async function POST(req: NextRequest) {
  const { orderCode, tool, input } = await req.json().catch(() => ({}));

  const systemPrompt = TOOL_SYSTEM_PROMPTS[tool as ToolMode];
  if (!systemPrompt || typeof input !== "string" || !input.trim()) {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const owner = isOwnerRequest(req);

  if (!owner) {
    if (!orderCode) {
      return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: order } = await db
      .from("orders")
      .select("status, services(tool_route)")
      .eq("order_code", orderCode)
      .single();

    const services = order?.services as unknown as { tool_route: string | null } | null;
    const unlocked = order?.status === "approved" && services?.tool_route === tool;
    if (!unlocked) {
      return NextResponse.json({ error: "رمز الطلب غير صالح أو لم تتم الموافقة عليه بعد" }, { status: 403 });
    }

    if (rateLimited(orderCode)) {
      return NextResponse.json({ error: "تم تجاوز الحد اليومي المسموح لهذا الاشتراك" }, { status: 429 });
    }
  }

  try {
    const output = await callGroq(systemPrompt, input.slice(0, 4000), 900);
    return NextResponse.json({ output });
  } catch (e: any) {
    if (e.message === "NO_API_KEY") {
      return NextResponse.json({ error: "الخدمة غير مفعّلة بعد على هذا السيرفر" }, { status: 503 });
    }
    return NextResponse.json({ error: "تعذّر الاتصال بمحرك الذكاء الاصطناعي الآن" }, { status: 502 });
  }
}
