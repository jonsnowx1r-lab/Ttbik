-- DigitalCard (Linktree-style business card) — Grok G4 / O1 website tool.
-- Run once in Supabase SQL Editor. Idempotent.

CREATE TABLE IF NOT EXISTS "DigitalCard" (
    "id"          TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "bio"         TEXT,
    "avatarUrl"   TEXT,
    "links"       JSONB NOT NULL,
    "theme"       TEXT NOT NULL DEFAULT 'simple',
    "views"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerIpHash" TEXT,
    "editToken"   TEXT NOT NULL,

    CONSTRAINT "DigitalCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DigitalCard_slug_key" ON "DigitalCard"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalCard_editToken_key" ON "DigitalCard"("editToken");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "DigitalCard" TO service_role;
