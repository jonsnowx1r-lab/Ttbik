import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = (params.code || "").trim();
  if (!code || code.length > 16) {
    return NextResponse.redirect(new URL("/", _req.url), 302);
  }

  try {
    const link = await prisma.shortLink.findUnique({ where: { code } });
    if (!link) {
      return new NextResponse("الرابط غير موجود أو انتهت صلاحيته", { status: 404 });
    }

    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return new NextResponse("انتهت صلاحية هذا الرابط", { status: 410 });
    }

    // Atomic click increment (fire-and-forget style; don't block redirect on failure)
    prisma.shortLink
      .update({
        where: { code },
        data: { clicks: { increment: 1 } },
      })
      .catch((e) => console.error("[s/code] click increment failed", e));

    return NextResponse.redirect(link.targetUrl, 302);
  } catch (e) {
    console.error("[s/code] lookup failed", e);
    return new NextResponse("خطأ مؤقت", { status: 500 });
  }
}
