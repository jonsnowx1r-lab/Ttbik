import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, requestIp } from "@/lib/rateLimit";
import { createHash } from "crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function generateCode(length = 7): string {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    out += BASE62[bytes[i] % 62];
  }
  return out;
}

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    // Block obvious non-navigable / XSS vectors
    if (/^(javascript|data|vbscript|file):/i.test(raw.trim())) return false;
    return true;
  } catch {
    return false;
  }
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.IP_HASH_SALT || "souqtools")).digest("hex").slice(0, 16);
}

export async function POST(req: NextRequest) {
  const ip = requestIp(req);
  if (isRateLimited(`shorten:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "لقد تجاوزت الحد المسموح مؤقتاً (10 روابط / 10 دقائق)، حاول لاحقاً" },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const days = typeof body.days === "number" ? body.days : null;

  if (!url || !isSafeUrl(url)) {
    return NextResponse.json(
      { error: "الرابط غير صالح. استخدم رابط يبدأ بـ http:// أو https:// فقط" },
      { status: 400 }
    );
  }

  if (url.length > 2048) {
    return NextResponse.json({ error: "الرابط طويل جداً" }, { status: 400 });
  }

  let expiresAt: Date | null = null;
  if (days === 7 || days === 30) {
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  // Retry a few times on rare code collision
  let link = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(7);
    try {
      link = await prisma.shortLink.create({
        data: {
          code,
          targetUrl: url,
          ownerIpHash: hashIp(ip),
          expiresAt,
        },
      });
      break;
    } catch (e: any) {
      // unique constraint on code — try again
      if (e?.code === "P2002") continue;
      console.error("[shorten] create failed", e);
      return NextResponse.json({ error: "تعذّر إنشاء الرابط القصير الآن" }, { status: 500 });
    }
  }

  if (!link) {
    return NextResponse.json({ error: "تعذّر إنشاء رمز فريد، حاول مجدداً" }, { status: 500 });
  }

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://ttbik.vercel.app");

  const shortUrl = `${site}/s/${link.code}`;

  return NextResponse.json({
    code: link.code,
    shortUrl,
    targetUrl: link.targetUrl,
    expiresAt: link.expiresAt,
    clicks: 0,
  });
}
