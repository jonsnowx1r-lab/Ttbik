import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const REQUIRED_SECONDS = 15;
// Small grace window so a client-side timer that fires a couple hundred ms
// early (setInterval drift) doesn't get rejected — the real gate is this
// server-side elapsed-time check against issuedAt, not the client's clock.
const TOLERANCE_MS = 500;
// Basic anti-multi-accounting: a fingerprint already tied to this many
// OTHER distinct accounts blocks a new account from verifying through it.
const FINGERPRINT_DISTINCT_USER_LIMIT = 2;

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const click = await prisma.adClick.findUnique({ where: { id: params.token } });
  if (!click) {
    return NextResponse.json({ ok: false, error: "الرابط غير صالح." }, { status: 404 });
  }
  if (click.verified) {
    return NextResponse.json({ ok: true });
  }
  const elapsedMs = Date.now() - new Date(click.issuedAt).getTime();
  if (elapsedMs < REQUIRED_SECONDS * 1000 - TOLERANCE_MS) {
    return NextResponse.json({ ok: false, error: "لم يمر الوقت المطلوب بعد، انتظر قليلاً ثم أعد المحاولة." }, { status: 400 });
  }

  // Basic anti-multi-accounting: a composite browser fingerprint computed
  // client-side, cross-checked against every other account that has ever
  // completed a click from the same device. Not enterprise-grade
  // (spoofable), but catches the common one-device-many-accounts pattern.
  const body = await req.json().catch(() => ({}));
  const fingerprint = typeof body?.fingerprint === "string" ? body.fingerprint.slice(0, 128) : null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  if (fingerprint) {
    await prisma.deviceFingerprint.upsert({
      where: { fingerprint_userId: { fingerprint, userId: click.userId } },
      update: { ip },
      create: { fingerprint, userId: click.userId, ip },
    });
    const seen = await prisma.deviceFingerprint.findMany({ where: { fingerprint }, select: { userId: true }, distinct: ["userId"] });
    const otherAccounts = seen.filter((d) => d.userId !== click.userId).length;
    if (otherAccounts >= FINGERPRINT_DISTINCT_USER_LIMIT) {
      await prisma.user.update({ where: { id: click.userId }, data: { multiAccountFlag: true } }).catch(() => null);
      return NextResponse.json({ ok: false, error: "تم رصد استخدام هذا الجهاز من عدة حسابات أخرى. تم إيقاف حسابك مؤقتاً — تواصل مع الدعم." }, { status: 403 });
    }
  }

  await prisma.adClick.update({ where: { id: click.id }, data: { verified: true } });
  return NextResponse.json({ ok: true });
}
