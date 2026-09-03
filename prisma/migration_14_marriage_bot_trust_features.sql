-- MARRIAGE_BOT trust/safety features (owner spec, 2026-09-05): Seriousness
-- Score needs no schema change (computed from existing data). Voice intro,
-- photo access consent, and the formal-contact-request flow do. Run once
-- in Supabase's SQL Editor. Idempotent.

ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "voiceFileId" TEXT;

ALTER TABLE "RandomChatSession" ADD COLUMN IF NOT EXISTS "messageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RandomChatSession" ADD COLUMN IF NOT EXISTS "contactOfferSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RandomChatSession" ADD COLUMN IF NOT EXISTS "contactRequestedBy" TEXT;

CREATE TABLE IF NOT EXISTS "MatchPhotoPermission" (
    "id"         TEXT NOT NULL,
    "ownerId"    TEXT NOT NULL,
    "viewerId"   TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchPhotoPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchPhotoPermission_ownerId_viewerId_key" ON "MatchPhotoPermission"("ownerId", "viewerId");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MatchPhotoPermission" TO service_role;
