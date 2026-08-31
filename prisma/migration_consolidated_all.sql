-- ============================================================================
-- CONSOLIDATED migration — every schema change made to the bot platform so
-- far in one script (equivalent to running migration_2, migration_3,
-- migration_4 and everything new in this pass, combined). Every statement
-- uses IF NOT EXISTS / guards, so it is SAFE to run even though your
-- database already has the base tables from init_migration.sql — anything
-- already applied is simply skipped.
--
-- Run once in Supabase → SQL Editor → New query → Run.
-- ============================================================================

-- ---- Base tables (in case this is ever run against a fresh database) ----

DO $$ BEGIN
  CREATE TYPE "AdType" AS ENUM ('LINK', 'TELEGRAM', 'YOUTUBE', 'TWITTER', 'TIKTOK', 'FACEBOOK', 'INSTAGRAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('USER', 'BOT_OWNER', 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Bot" (
    "id"            TEXT NOT NULL,
    "token"         TEXT NOT NULL,
    "ownerId"       TEXT NOT NULL,
    "template"      TEXT NOT NULL,
    "totalRevenue"  DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ownerBalance"  DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "webhookSecret" TEXT NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "User" (
    "id"             TEXT NOT NULL,
    "botId"          TEXT NOT NULL,
    "role"           "Role" NOT NULL DEFAULT 'USER',
    "balance"        DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "depositAddress" TEXT,
    "referredBy"     TEXT,
    "pendingAction"  JSONB,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Ad" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "botId"       TEXT NOT NULL,
    "type"        "AdType" NOT NULL,
    "content"     TEXT NOT NULL,
    "totalBudget" DOUBLE PRECISION NOT NULL,
    "cpc"         DOUBLE PRECISION NOT NULL,
    "ownerCut"    DOUBLE PRECISION NOT NULL,
    "creatorCut"  DOUBLE PRECISION NOT NULL,
    "workerCut"   DOUBLE PRECISION NOT NULL,
    "remaining"   DOUBLE PRECISION NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Transaction" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "amount"     DOUBLE PRECISION NOT NULL,
    "currency"   TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "status"     TEXT NOT NULL,
    "txHash"     TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Bot_token_key" ON "Bot"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_txHash_key" ON "Transaction"("txHash");

DO $$ BEGIN
  ALTER TABLE "Ad" ADD CONSTRAINT "Ad_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Ad" ADD CONSTRAINT "Ad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- migration_2: language preference ----
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'ar';

-- ---- migration_3: mandatory channel, campaign scope, tx bot attribution ----
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "requiredChannel" TEXT;
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'TARGETED';
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "targetBotId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "botId" TEXT;
UPDATE "Ad" SET "scope" = 'GLOBAL', "targetBotId" = NULL WHERE "cpc" = 0 AND "scope" = 'TARGETED';

-- ---- migration_4: link-timer anti-cheat (AdClick) ----
CREATE TABLE IF NOT EXISTS "AdClick" (
    "id"         TEXT NOT NULL,
    "adId"       TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "botId"      TEXT NOT NULL,
    "issuedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified"   BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdClick_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdClick_adId_userId_key" ON "AdClick"("adId", "userId");

-- ---- This pass: Bot Owner referral, 48h hold, phone/device fraud checks,
--      auto-moderation report counter ----
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "referredByOwnerId" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "multiAccountFlag" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "reportCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "AdReport" (
    "id"         TEXT NOT NULL,
    "adId"       TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdReport_adId_userId_key" ON "AdReport"("adId", "userId");

CREATE TABLE IF NOT EXISTS "DeviceFingerprint" (
    "id"          TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "ip"          TEXT,
    "userId"      TEXT NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceFingerprint_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceFingerprint_fingerprint_userId_key" ON "DeviceFingerprint"("fingerprint", "userId");
