import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isOwnerRequest } from "@/lib/isOwner";

/**
 * Order-code verification for "studio" tools (real client-side tools, no AI
 * call) — mirrors the unlock check in /api/tools/run but skips straight to
 * a boolean, since the studio component does all the work in the browser.
 */
export async function POST(req: NextRequest) {
  const { orderCode, tool } = await req.json().catch(() => ({}));

  if (isOwnerRequest(req)) {
    return NextResponse.json({ unlocked: true });
  }

  if (typeof orderCode !== "string" || !orderCode.trim() || typeof tool !== "string" || !tool) {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select("status, services(tool_route)")
    .eq("order_code", orderCode.trim().toUpperCase())
    .single();

  const services = order?.services as unknown as { tool_route: string | null } | null;
  const unlocked = order?.status === "approved" && services?.tool_route === tool;

  if (!unlocked) {
    return NextResponse.json({ error: "رمز الطلب غير صالح أو لم تتم الموافقة عليه بعد" }, { status: 403 });
  }

  return NextResponse.json({ unlocked: true });
}
