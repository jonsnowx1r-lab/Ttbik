import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("bot_owner_withdrawals")
    .select("id, bot_id, amount, status, payout_address, note, created_at, hosted_bots(public_code, owner_contact)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ withdrawals: [], error: error.message });
  return NextResponse.json({ withdrawals: data ?? [] });
}

/**
 * Approve records the decision only — the owner sends the real crypto/bank
 * transfer manually outside this system, same manual-review pattern as
 * every other payout on this site. Reject refunds the amount back to the
 * bot's owner_balance so the creator isn't out their commission.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const action = String(body.action || "");
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: wd } = await db.from("bot_owner_withdrawals").select("id, bot_id, amount, status").eq("id", id).maybeSingle();
  if (!wd) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (wd.status !== "pending") return NextResponse.json({ error: "تمت معالجة هذا الطلب مسبقاً" }, { status: 409 });

  if (action === "reject") {
    const { data: bot } = await db.from("hosted_bots").select("owner_balance").eq("id", wd.bot_id).maybeSingle();
    const refunded = Math.round((Number(bot?.owner_balance || 0) + Number(wd.amount || 0)) * 100) / 100;
    await db.from("hosted_bots").update({ owner_balance: refunded }).eq("id", wd.bot_id);
    await db.from("bot_owner_withdrawals").update({ status: "rejected", note: "رُفض الطلب وأُعيد المبلغ لرصيد صاحب البوت" }).eq("id", id);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  await db.from("bot_owner_withdrawals").update({ status: "approved", note: "تمت الموافقة — التحويل يتم يدوياً من المالك" }).eq("id", id);
  return NextResponse.json({ ok: true, status: "approved" });
}
