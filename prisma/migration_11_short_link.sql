-- ShortLink (URL shortener) — Grok G3 / O1 website tool.
-- Run once in Supabase SQL Editor. Idempotent.

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
