import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Protected by src/middleware.ts (matches /api/admin/:path*) — same
// pattern as the plain GET /api/admin/orders route, no extra per-route
// check needed here since this is read-only and not customer PII.
//
// force-dynamic: this GET has no request-scoped input (no cookies/headers/
// searchParams), so Next.js would otherwise treat it as a static route and
// bake its response into the build output — freezing admin analytics at
// whatever the DB returned at build/deploy time instead of live data.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = supabaseAdmin();

  const [totals, topPages, topReferrers, devices, daily] = await Promise.all([
    db.rpc("analytics_totals"),
    db.rpc("analytics_top_pages", { days_back: 30, limit_n: 10 }),
    db.rpc("analytics_top_referrers", { days_back: 30, limit_n: 10 }),
    db.rpc("analytics_device_breakdown", { days_back: 30 }),
    db.rpc("analytics_daily", { days_back: 14 }),
  ]);

  if (totals.error) {
    return NextResponse.json({ error: totals.error.message }, { status: 500 });
  }

  return NextResponse.json({
    totals: totals.data?.[0] ?? null,
    topPages: topPages.data ?? [],
    topReferrers: topReferrers.data ?? [],
    devices: devices.data ?? [],
    daily: daily.data ?? [],
  });
}
