import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "ttbik_admin";

/** Server component usage — reads the same cookie the /admin dashboard sets. */
export function isOwnerServer(): boolean {
  const value = cookies().get(COOKIE_NAME)?.value;
  return !!value && value === process.env.ADMIN_PASSWORD;
}

/** Route handler usage — reads the cookie straight off the request. */
export function isOwnerRequest(req: NextRequest): boolean {
  const value = req.cookies.get(COOKIE_NAME)?.value;
  return !!value && value === process.env.ADMIN_PASSWORD;
}
