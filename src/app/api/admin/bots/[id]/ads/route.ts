import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseAdmin()
    .from("bot_ads")
    .select("id, title, reward_points, is_active")
    .eq("bot_id", params.id)
    .order("title");
  if (error) return NextResponse.json({ ads: [], error: error.message });
  return NextResponse.json({ ads: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const rewardPoints = Math.max(1, Math.min(1000, Number(body.rewardPoints) || 1));
  if (!title) return NextResponse.json({ error: "أدخل عنوان الإعلان" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("bot_ads")
    .insert({ bot_id: params.id, title, reward_points: rewardPoints, is_active: true })
    .select("id, title, reward_points, is_active")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ad: data });
}
