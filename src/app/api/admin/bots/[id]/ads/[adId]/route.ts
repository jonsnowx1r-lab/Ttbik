import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: { id: string; adId: string } }) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const db = supabaseAdmin();

  if (action === "toggle") {
    const { data: ad } = await db.from("bot_ads").select("is_active").eq("id", params.adId).eq("bot_id", params.id).maybeSingle();
    if (!ad) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    const { error } = await db.from("bot_ads").update({ is_active: !ad.is_active }).eq("id", params.adId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, is_active: !ad.is_active });
  }

  if (action === "delete") {
    const { error } = await db.from("bot_ads").delete().eq("id", params.adId).eq("bot_id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
}
