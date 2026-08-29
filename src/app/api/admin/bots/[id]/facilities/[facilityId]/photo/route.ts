import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tgGetFileUrl } from "@/lib/tgApi";

/** Redirects to the license photo Telegram is hosting — protected by middleware.ts like every /api/admin/* route. */
export async function GET(_req: NextRequest, { params }: { params: { id: string; facilityId: string } }) {
  const db = supabaseAdmin();
  const { data: bot } = await db.from("hosted_bots").select("bot_token").eq("id", params.id).maybeSingle();
  const { data: facility } = await db
    .from("medical_facilities")
    .select("license_photo_file_id")
    .eq("id", params.facilityId)
    .eq("bot_id", params.id)
    .maybeSingle();
  if (!bot || !facility?.license_photo_file_id) {
    return NextResponse.json({ error: "لا توجد صورة" }, { status: 404 });
  }
  const url = await tgGetFileUrl(bot.bot_token, facility.license_photo_file_id);
  if (!url) return NextResponse.json({ error: "تعذّر جلب الصورة من تيليجرام" }, { status: 502 });
  return NextResponse.redirect(url);
}
