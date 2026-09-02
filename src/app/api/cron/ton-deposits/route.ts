import { NextRequest, NextResponse } from "next/server";
import { scanTonDeposits } from "@/services/ton-service";

// Native TON deposit scanner (owner spec, 2026-09-02). Runs daily via
// Vercel Cron (vercel.json) — Vercel's Hobby plan caps cron at once daily,
// so a TON deposit can take up to ~24h to actually land in a user's
// balance. Real limitation of the free tier; a paid plan (more frequent
// cron) or an external pinger would be needed to shorten it.
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  return auth === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.MASTER_TON_MNEMONIC || !process.env.MASTER_HOT_WALLET_ADDRESS) {
    return NextResponse.json({ ok: true, skipped: "native TON not configured" });
  }
  try {
    const result = await scanTonDeposits();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "scan failed" }, { status: 500 });
  }
}
