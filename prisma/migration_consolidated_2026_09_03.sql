-- Consolidated SQL for everything shipped today (2026-09-03): MARRIAGE_BOT's
-- own financial ledger, trust/safety features, and all 8 paid features.
-- Same as running migration_13 + migration_14 + migration_15 in order —
-- this file just merges them into one paste. Idempotent, safe to re-run.

-- === MatchUser (new columns) ===
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "tonMemo" TEXT;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "advancedFiltersUnlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "profileVisitorsUnlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "extraPhotosUnlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "vipUntil" TIMESTAMP(3);
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "referralRewardGranted" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "MatchUser_tonMemo_key" ON "MatchUser"("tonMemo");

-- === MatchProfile (new columns) ===
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "voiceFileId" TEXT;
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "photoFileId2" TEXT;
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "photoFileId3" TEXT;
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "boostedUntil" TIMESTAMP(3);
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "verificationPhotoFileId" TEXT;
ALTER TABLE "MatchProfile" ADD COLUMN IF NOT EXISTS "isIncognito" BOOLEAN NOT NULL DEFAULT false;

-- === PartnerPreference (new columns) ===
ALTER TABLE "PartnerPreference" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "PartnerPreference" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;

-- === MatchLike (new column) ===
ALTER TABLE "MatchLike" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- === RandomChatSession (new columns) ===
ALTER TABLE "RandomChatSession" ADD COLUMN IF NOT EXISTS "messageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RandomChatSession" ADD COLUMN IF NOT EXISTS "contactOfferSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RandomChatSession" ADD COLUMN IF NOT EXISTS "contactRequestedBy" TEXT;

-- === New table: MatchTransaction (MARRIAGE_BOT's isolated ledger) ===
CREATE TABLE IF NOT EXISTS "MatchTransaction" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "amount"     DOUBLE PRECISION NOT NULL,
    "currency"   TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'COMPLETED',
    "txHash"     TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MatchTransaction_txHash_key" ON "MatchTransaction"("txHash");
DO $$ BEGIN
    ALTER TABLE "MatchTransaction" ADD CONSTRAINT "MatchTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MatchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MatchTransaction" TO service_role;

-- === New table: MatchPhotoPermission (photo access consent) ===
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

-- === New table: MatchProfileVisit (profile visitors) ===
CREATE TABLE IF NOT EXISTS "MatchProfileVisit" (
    "id"        TEXT NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "viewerId"  TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchProfileVisit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MatchProfileVisit_ownerId_viewerId_key" ON "MatchProfileVisit"("ownerId", "viewerId");
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MatchProfileVisit" TO service_role;
