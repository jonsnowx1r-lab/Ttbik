import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const db = supabaseAdmin();
  const [{ count: botsCount }, { count: usersCount }, ledgerRes, { count: pendingWithdrawals }] = await Promise.all([
    db.from("hosted_bots").select("id", { count: "exact", head: true }),
    db.from("bot_members").select("id", { count: "exact", head: true }),
    db.from("platform_ledger").select("total_revenue").eq("id", true).maybeSingle(),
    db.from("bot_owner_withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return NextResponse.json({
    botsCount: botsCount ?? 0,
    usersCount: usersCount ?? 0,
    totalRevenue: Number(ledgerRes.data?.total_revenue || 0),
    pendingWithdrawals: pendingWithdrawals ?? 0,
  });
}
