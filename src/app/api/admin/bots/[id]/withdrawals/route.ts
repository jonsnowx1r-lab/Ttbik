import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseAdmin()
    .from("bot_wallet_tx")
    .select("id, tg_user_id, amount, status, note, created_at")
    .eq("bot_id", params.id)
    .eq("kind", "withdrawal")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ withdrawals: [], error: error.message });
  return NextResponse.json({ withdrawals: data ?? [] });
}

/**
 * Approve/reject a withdrawal request. Points were already deducted when the
 * member submitted the request (see botEngine.ts "سحب:" handler) — approving
 * here only records the decision (the owner transfers the money manually
 * outside this system, same manual-review pattern as every other payment on
 * this site); rejecting refunds the points back to the member.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const txId = String(body.txId || "");
  const action = String(body.action || "");
  if (!txId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: tx } = await db
    .from("bot_wallet_tx")
    .select("id, tg_user_id, amount, status")
    .eq("id", txId)
    .eq("bot_id", params.id)
    .eq("kind", "withdrawal")
    .maybeSingle();
  if (!tx) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (tx.status !== "pending") return NextResponse.json({ error: "تمت معالجة هذا الطلب مسبقاً" }, { status: 409 });

  if (action === "reject") {
    const { data: member } = await db
      .from("bot_members")
      .select("id, points")
      .eq("bot_id", params.id)
      .eq("tg_user_id", tx.tg_user_id)
      .maybeSingle();
    if (member) {
      const refunded = Math.round((Number(member.points || 0) + Number(tx.amount || 0)) * 100) / 100;
      await db.from("bot_members").update({ points: refunded }).eq("id", member.id);
    }
    await db.from("bot_wallet_tx").update({ status: "rejected", note: "رُفض الطلب وأُعيدت النقاط" }).eq("id", txId);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  await db.from("bot_wallet_tx").update({ status: "approved", note: "تمت الموافقة — التحويل يتم يدوياً من المالك" }).eq("id", txId);
  return NextResponse.json({ ok: true, status: "approved" });
}
