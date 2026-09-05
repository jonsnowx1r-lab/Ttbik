import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// force-dynamic: no request-scoped input here either, so without this
// Next.js would statically bake the order list into the build output —
// freezing the admin orders list at build/deploy time instead of live data.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("orders")
    .select("*, services(name_ar, slug)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data });
}
