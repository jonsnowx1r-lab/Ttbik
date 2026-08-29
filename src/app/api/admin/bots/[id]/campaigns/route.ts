import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseAdmin()
    .from("ad_tasks")
    .select("id, advertiser_tg_user_id, task_type, target, reward_points, slots_total, slots_remaining, status, created_at")
    .eq("bot_id", params.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ campaigns: [], error: error.message });
  return NextResponse.json({ campaigns: data ?? [] });
}

/**
 * Approve puts the campaign live in "المهام" for every other member.
 * Reject refunds the full pre-paid budget (reward_points * slots_total)
 * back to the advertiser — the points were deducted immediately at
 * creation time in adNetworkBot.ts.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const taskId = String(body.taskId || "");
  const action = String(body.action || "");
  if (!taskId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data: task } = await db.from("ad_tasks").select("*").eq("id", taskId).eq("bot_id", params.id).maybeSingle();
  if (!task) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 });
  if (task.status !== "pending") return NextResponse.json({ error: "تمت معالجة هذه الحملة مسبقاً" }, { status: 409 });

  if (action === "reject") {
    const refund = Number(task.reward_points) * Number(task.slots_total);
    const { data: member } = await db
      .from("bot_members")
      .select("id, points")
      .eq("bot_id", params.id)
      .eq("tg_user_id", task.advertiser_tg_user_id)
      .maybeSingle();
    if (member) {
      await db.from("bot_members").update({ points: Number(member.points || 0) + refund }).eq("id", member.id);
    }
    await db.from("ad_tasks").update({ status: "rejected" }).eq("id", taskId);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  await db.from("ad_tasks").update({ status: "active" }).eq("id", taskId);
  return NextResponse.json({ ok: true, status: "active" });
}
