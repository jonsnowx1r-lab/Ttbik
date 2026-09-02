import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = (params.code || "").trim();
  if (!code || code.length > 16 || !/^[0-9A-Za-z]+$/.test(code)) {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL || "https://ttbik.vercel.app"));
  }

  const row = await prisma.shortLink.findUnique({ where: { code } });
  if (!row) {
    return new NextResponse("الرابط غير موجود أو منتهي", { status: 404 });
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return new NextResponse("انتهت صلاحية هذا الرابط", { status: 410 });
  }

  // Atomic click increment — fire-and-forget is fine; redirect must be fast.
  prisma.shortLink
    .update({ where: { code }, data: { clicks: { increment: 1 } } })
    .catch((e) => console.error("[s/code] click++ failed", e));

  return NextResponse.redirect(row.targetUrl, 302);
}
