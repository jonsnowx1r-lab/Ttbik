-- G3 URL shortener (ShortLink). Idempotent — safe to re-run.
-- Run once in Supabase SQL Editor after deploy.

CREATE TABLE IF NOT EXISTS "ShortLink" (
    "id"          TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "targetUrl"   TEXT NOT NULL,
    "clicks"      INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerIpHash" TEXT,
    "expiresAt"   TIMESTAMP(3),

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShortLink_code_key" ON "ShortLink"("code");

-- Service role needs full access for the Next.js API routes (same pattern as other tables).
GRANT ALL ON TABLE "ShortLink" TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE "ShortLink" TO authenticated;
GRANT SELECT ON TABLE "ShortLink" TO anon;
