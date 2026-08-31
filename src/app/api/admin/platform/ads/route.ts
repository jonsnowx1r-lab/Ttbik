import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("platform_ads")
    .select("id, platform, description, target, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ads: [], error: error.message });
  return NextResponse.json({ ads: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const platform = String(body.platform || "").trim();
  const target = String(body.target || "").trim();
  const description = String(body.description || "").trim();
  if (!platform || !target) return NextResponse.json({ error: "المنصة والرابط مطلوبان" }, { status: 400 });

  const { error } = await supabaseAdmin().from("platform_ads").insert({ platform, target, description: description || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  const { error } = await supabaseAdmin().from("platform_ads").update({ is_active: !!body.is_active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
