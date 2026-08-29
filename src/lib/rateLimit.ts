/**
 * Best-effort in-memory rate limiter for a single serverless instance.
 * Resets on cold start and isn't shared across instances — that's an
 * accepted trade-off on a zero-budget stack with no Redis/KV. It still
 * blocks the common case (one visitor hammering an endpoint from one
 * warm instance) without adding any paid infrastructure.
 */
const hits = new Map<string, { count: number; windowStart: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    hits.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

export function requestIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}
