import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const REQUIRED_SECONDS = 15;
// Small grace window so a client-side timer that fires a couple hundred ms
// early (setInterval drift) doesn't get rejected — the real gate is this
// server-side elapsed-time check against issuedAt, not the client's clock.
const TOLERANCE_MS = 500;

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
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
  await prisma.adClick.update({ where: { id: click.id }, data: { verified: true } });
  return NextResponse.json({ ok: true });
}
