import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const REQUIRED_SECONDS = 15;

// AdClick.content isn't guaranteed to be a full URL — LINK/YOUTUBE ads
// usually get one, but TWITTER/INSTAGRAM/TIKTOK/FACEBOOK ads may just carry
// a bare @handle from the ad-creation flow's free-text "target" step.
function normalizeTargetUrl(type: string, content: string): string {
  const raw = content.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "");
  switch (type) {
    case "TWITTER":
      return `https://x.com/${handle}`;
    case "INSTAGRAM":
      return `https://instagram.com/${handle}`;
    case "TIKTOK":
      return `https://tiktok.com/@${handle}`;
    case "FACEBOOK":
      return `https://facebook.com/${handle}`;
    case "YOUTUBE":
      return `https://youtube.com/${handle}`;
    default:
      return `https://${raw}`;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const click = await prisma.adClick.findUnique({ where: { id: params.token } });
  if (!click) {
    return NextResponse.json({ ok: false, error: "الرابط غير صالح أو منتهي." }, { status: 404 });
  }
  const ad = await prisma.ad.findUnique({ where: { id: click.adId } });
  if (!ad || ad.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "هذا الإعلان لم يعد متاحاً." }, { status: 410 });
  }
  return NextResponse.json({
    ok: true,
    verified: click.verified,
    issuedAt: click.issuedAt,
    requiredSeconds: REQUIRED_SECONDS,
    targetUrl: normalizeTargetUrl(ad.type, ad.content),
  });
}
