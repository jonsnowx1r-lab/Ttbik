import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, requestIp } from "@/lib/rateLimit";
import { createHash } from "crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const CODE_LEN = 7;
const MAX_URL_LEN = 2048;

function randomCode(): string {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  for (let i = 0; i < CODE_LEN; i++) out += BASE62[bytes[i]! % 62];
  return out;
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    // Block obvious javascript:/data:/file: already covered by protocol check.
    if (!u.hostname || u.hostname === "localhost") return false;
    return true;
  } catch {
    return false;
  }
}

function ipHash(ip: string): string {
  return createHash("sha256").update(ip + (process.env.SHORTLINK_SALT || "souqtools")).digest("hex").slice(0, 16);
}

export async function POST(req: NextRequest) {
  const ip = requestIp(req);
  if (isRateLimited(`shorten:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "لقد تجاوزت الحد المسموح مؤقتاً، حاول بعد قليل" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const expireDays = typeof body.expireDays === "number" ? body.expireDays : null;

  if (!url || url.length > MAX_URL_LEN) {
    return NextResponse.json({ error: "رابط غير صالح" }, { status: 400 });
  }
  if (!isValidHttpUrl(url)) {
    return NextResponse.json({ error: "يُقبل فقط روابط http أو https صحيحة" }, { status: 400 });
  }

  let expiresAt: Date | null = null;
  if (expireDays === 7 || expireDays === 30) {
    expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);
  }

  // Retry a few times on rare code collision.
  let code = "";
  let created = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = randomCode();
    try {
      created = await prisma.shortLink.create({
        data: {
          code,
          targetUrl: url,
          ownerIpHash: ipHash(ip),
          expiresAt,
        },
      });
      break;
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      if (msg === "P2002") continue; // unique violation on code
      console.error("[shorten] create failed", e);
      return NextResponse.json({ error: "تعذر إنشاء الرابط القصير الآن" }, { status: 500 });
    }
  }
  if (!created) {
    return NextResponse.json({ error: "تعذر إنشاء الرابط القصير الآن" }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app";
  const shortUrl = `${base.replace(/\/$/, "")}/s/${code}`;
  // Free public QR endpoint (no API key, no ongoing cost).
  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shortUrl)}`;

  return NextResponse.json({
    code,
    shortUrl,
    qrDataUrl,
    clicks: 0,
    expiresAt: expiresAt?.toISOString() ?? null,
  });
}
