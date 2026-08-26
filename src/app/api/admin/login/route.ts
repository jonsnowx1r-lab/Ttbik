import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));
  const submitted = typeof password === "string" ? password.trim() : "";
  const expected = (process.env.ADMIN_PASSWORD || "").trim();

  if (!submitted || !expected || submitted !== expected) {
    return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("ttbik_admin", submitted, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
