import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, requestIp } from "@/lib/rateLimit";
import { createHash } from "crypto";

const CODE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LEN = 7;

function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    // block obvious dangerous schemes already covered; also reject empty host
    if (!u.hostname) return false;
    return true;
  } catch {
    return false;
  }
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.RATE_LIMIT_SALT || "st")).digest("hex").slice(0, 16);
}

export async function POST(req: NextRequest) {
  const ip = requestIp(req);
  if (isRateLimited(`shorten:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "تجاوزت الحد المسموح (10 روابط / 10 دقائق). حاول لاحقاً." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const days = body.expiresDays === 7 || body.expiresDays === 30 ? body.expiresDays : null;

  if (!url || !isSafeUrl(url)) {
    return NextResponse.json(
      { error: "رابط غير صالح. استخدم http أو https فقط." },
      { status: 400 }
    );
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app";
  let code = generateCode();
  let attempts = 0;
  while (attempts < 8) {
    const existing = await prisma.shortLink.findUnique({ where: { code } });
    if (!existing) break;
    code = generateCode();
    attempts++;
  }

  const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

  try {
    const row = await prisma.shortLink.create({
      data: {
        code,
        targetUrl: url,
        ownerIpHash: hashIp(ip),
        expiresAt,
      },
    });

    const shortUrl = `${site.replace(/\/$/, "")}/s/${row.code}`;

    return NextResponse.json({
      code: row.code,
      shortUrl,
      clicks: 0,
      expiresAt: row.expiresAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "db error";
    return NextResponse.json({ error: "تعذر إنشاء الرابط", detail: msg }, { status: 500 });
  }
}
