import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tgIsChannelMember } from "@/lib/tgApi";

/**
 * Awards points for watching one specific ad, exactly once per member.
 * The unique(ad_id, tg_user_id) constraint on bot_ad_views is the real
 * guard against double-claiming — this route just surfaces that cleanly.
 * Also writes a confirmed bot_wallet_tx row (kind=ad_view) for audit only (no cash).
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

  const { data: bot } = await db.from("hosted_bots").select("id, bot_token").eq("public_code", publicCode).maybeSingle();
  if (!bot) return NextResponse.json({ error: "البوت غير موجود" }, { status: 404 });

  const { data: ad } = await db
    .from("bot_ads")
    .select("id, title, reward_points, is_active, channel_username")
    .eq("id", adId)
    .eq("bot_id", bot.id)
    .maybeSingle();
  if (!ad || !ad.is_active) return NextResponse.json({ error: "الإعلان غير متاح" }, { status: 404 });

  if (ad.channel_username) {
    const numericUid = Number(uid);
    const isMember = Number.isFinite(numericUid) && (await tgIsChannelMember(bot.bot_token, ad.channel_username, numericUid));
    if (!isMember) {
      return NextResponse.json(
        { error: `انضم إلى القناة أولاً: @${ad.channel_username.replace(/^@/, "")}` },
        { status: 403 }
      );
    }
  }

  const { error: viewError } = await db.from("bot_ad_views").insert({ bot_id: bot.id, ad_id: adId, tg_user_id: uid });
  if (viewError) {
    return NextResponse.json({ error: "شاهدت هذا الإعلان مسبقاً — لا يمكن الحصول على النقاط مرتين." }, { status: 409 });
  }

  const reward = Number(ad.reward_points || 0);
  const { data: member } = await db
    .from("bot_members")
    .select("id, points")
    .eq("bot_id", bot.id)
    .eq("tg_user_id", uid)
    .maybeSingle();
  const newPoints = Number(member?.points || 0) + reward;
  if (member) {
    await db.from("bot_members").update({ points: newPoints }).eq("id", member.id);
  } else {
    await db.from("bot_members").insert({ bot_id: bot.id, tg_user_id: uid, points: newPoints });
  }

  // Audit trail only — no cash, same pattern as checkin/referral
  const { error: txErr } = await db.from("bot_wallet_tx").insert({
    bot_id: bot.id,
    tg_user_id: uid,
    kind: "ad_view",
    amount: reward,
    status: "confirmed",
    payment_method: null,
    note: ad.title ? `مشاهدة: ${ad.title}` : `ad ${adId}`,
  });
  if (txErr) console.error("ad_view logPointsTx failed:", txErr.message);

  return NextResponse.json({ ok: true, awarded: reward, balance: newPoints });
}
