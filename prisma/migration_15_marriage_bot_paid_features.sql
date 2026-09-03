-- MARRIAGE_BOT's 8 paid features (owner spec, 2026-09-05): Profile Boost,
-- Verified Badge, extra photos, Profile Visitors, advanced filters, Super
-- Like, Golden VIP membership, referral growth + incognito. All charges go
-- through MatchTransaction (already created in migration_13) — no new
-- financial tables needed here, just the feature-state columns. Run once
-- in Supabase's SQL Editor. Idempotent.

ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "advancedFiltersUnlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "profileVisitorsUnlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "extraPhotosUnlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "vipUntil" TIMESTAMP(3);
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "referralRewardGranted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "photoFileId2" TEXT;
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "photoFileId3" TEXT;
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "boostedUntil" TIMESTAMP(3);
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "verificationPhotoFileId" TEXT;
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "isIncognito" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PartnerPreference" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "PartnerPreference" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;

ALTER TABLE "MatchLike" ADD COLUMN IF NOT EXISTS "note" TEXT;

CREATE TABLE IF NOT EXISTS "MatchProfileVisit" (
    "id"        TEXT NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "viewerId"  TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchProfileVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchProfileVisit_ownerId_viewerId_key" ON "MatchProfileVisit"("ownerId", "viewerId");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MatchProfileVisit" TO service_role;
