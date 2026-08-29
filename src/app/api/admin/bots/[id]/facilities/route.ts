import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseAdmin()
    .from("medical_facilities")
    .select("id, name, facility_type, city_text, owner_tg_user_id, license_number, verification_status, created_at, locations(name)")
    .eq("bot_id", params.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ facilities: [], error: error.message });
  return NextResponse.json({ facilities: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const facilityId = String(body.facilityId || "");
  const action = String(body.action || "");
  if (!facilityId || !["verify", "reject"].includes(action)) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }
  const { error } = await supabaseAdmin()
    .from("medical_facilities")
    .update({ verification_status: action === "verify" ? "verified" : "rejected" })
    .eq("id", facilityId)
    .eq("bot_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
