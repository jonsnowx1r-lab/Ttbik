-- URL shortener (Grok O1/G3, 2026-09-02). Run once in Supabase SQL Editor.
-- Isolated free-tool table; no foreign keys into AD_BOT / MARRIAGE_BOT models.

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

-- Grant service_role full access (same pattern as other migrations)
GRANT ALL ON TABLE "ShortLink" TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE "ShortLink" TO anon, authenticated;
