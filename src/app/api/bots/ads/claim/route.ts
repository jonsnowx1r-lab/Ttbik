import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Awards points for watching one specific ad, exactly once per member.
 * The unique(ad_id, tg_user_id) constraint on bot_ad_views is the real
 * guard against double-claiming — this route just surfaces that cleanly.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const publicCode = String(body?.publicCode || "").trim();
  const uid = String(body?.uid || "").trim();
  const adId = String(body?.adId || "").trim();
  if (!publicCode || !uid || !adId) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: bot } = await db.from("hosted_bots").select("id").eq("public_code", publicCode).maybeSingle();
  if (!bot) return NextResponse.json({ error: "البوت غير موجود" }, { status: 404 });

  const { data: ad } = await db
    .from("bot_ads")
    .select("id, reward_points, is_active")
    .eq("id", adId)
    .eq("bot_id", bot.id)
    .maybeSingle();
  if (!ad || !ad.is_active) return NextResponse.json({ error: "الإعلان غير متاح" }, { status: 404 });

  const { error: viewError } = await db.from("bot_ad_views").insert({ bot_id: bot.id, ad_id: adId, tg_user_id: uid });
  if (viewError) {
    return NextResponse.json({ error: "شاهدت هذا الإعلان مسبقاً — لا يمكن الحصول على النقاط مرتين." }, { status: 409 });
  }

  const { data: member } = await db
    .from("bot_members")
    .select("id, points")
    .eq("bot_id", bot.id)
    .eq("tg_user_id", uid)
    .maybeSingle();
  const newPoints = Number(member?.points || 0) + Number(ad.reward_points || 0);
  if (member) {
    await db.from("bot_members").update({ points: newPoints }).eq("id", member.id);
  } else {
    await db.from("bot_members").insert({ bot_id: bot.id, tg_user_id: uid, points: newPoints });
  }

  return NextResponse.json({ ok: true, awarded: ad.reward_points, balance: newPoints });
}
