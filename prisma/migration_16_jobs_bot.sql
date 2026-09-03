-- JOBS_BOT — فرص عمل + متجر بيع وشراء (owner spec, 2026-09-05). Fully
-- independent tables from AD_BOT and MARRIAGE_BOT. Run once in Supabase's
-- SQL Editor. Idempotent.

CREATE TABLE IF NOT EXISTS "JobsUser" (
    "id"            TEXT NOT NULL,
    "botId"         TEXT NOT NULL,
    "phoneNumber"   TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "pendingAction" JSONB,
    "lastActiveAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBanned"      BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil"    TIMESTAMP(3),
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "balance"       DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "tonMemo"       TEXT,

    CONSTRAINT "JobsUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobsUser_tonMemo_key" ON "JobsUser"("tonMemo");

CREATE TABLE IF NOT EXISTS "JobsProfile" (
    "id"                      TEXT NOT NULL,
    "userId"                  TEXT NOT NULL,
    "name"                    TEXT NOT NULL,
    "age"                     INTEGER NOT NULL,
    "country"                 TEXT NOT NULL,
    "governorate"             TEXT NOT NULL,
    "city"                    TEXT NOT NULL,
    "contactMethod"           TEXT NOT NULL,
    "contactValue"            TEXT NOT NULL,
    "roleType"                TEXT NOT NULL,
    "seekerProfession"        TEXT,
    "employerBusinessName"    TEXT,
    "professionalCategory"    TEXT,
    "professionalDescription" TEXT,
    "isPaused"                BOOLEAN NOT NULL DEFAULT false,
    "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobsProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobsProfile_userId_key" ON "JobsProfile"("userId");

CREATE TABLE IF NOT EXISTS "JobPosting" (
    "id"            TEXT NOT NULL,
    "posterId"      TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "keywords"      TEXT NOT NULL,
    "workersCount"  INTEGER NOT NULL DEFAULT 1,
    "governorate"   TEXT NOT NULL,
    "city"          TEXT NOT NULL,
    "description"   TEXT,
    "contactMethod" TEXT NOT NULL,
    "contactValue"  TEXT NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'OPEN',
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StoreListing" (
    "id"             TEXT NOT NULL,
    "sellerId"       TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "description"    TEXT,
    "price"          DOUBLE PRECISION NOT NULL,
    "photoFileIds"   JSONB,
    "deliveryMethod" TEXT NOT NULL,
    "paymentMethod"  TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StoreWantedListing" (
    "id"          TEXT NOT NULL,
    "buyerId"     TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "budget"      DOUBLE PRECISION,
    "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreWantedListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StoreOrder" (
    "id"             TEXT NOT NULL,
    "buyerId"        TEXT NOT NULL,
    "sellerId"       TEXT NOT NULL,
    "listingId"      TEXT NOT NULL,
    "amount"         DOUBLE PRECISION NOT NULL,
    "deliveryMethod" TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "escrowedAt"     TIMESTAMP(3),
    "releasedAt"     TIMESTAMP(3),
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JobsDispute" (
    "id"                     TEXT NOT NULL,
    "orderId"                TEXT NOT NULL,
    "openedBy"               TEXT NOT NULL,
    "buyerStatement"         TEXT,
    "buyerEvidencePhotoIds"  JSONB,
    "sellerStatement"        TEXT,
    "sellerEvidencePhotoIds" JSONB,
    "status"                 TEXT NOT NULL DEFAULT 'OPEN',
    "resolution"             TEXT,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"             TIMESTAMP(3),

    CONSTRAINT "JobsDispute_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobsDispute_orderId_key" ON "JobsDispute"("orderId");

CREATE TABLE IF NOT EXISTS "JobsReport" (
    "id"                  TEXT NOT NULL,
    "reporterId"          TEXT NOT NULL,
    "targetId"            TEXT NOT NULL,
    "targetKind"          TEXT NOT NULL DEFAULT 'profile',
    "reason"              TEXT NOT NULL,
    "evidencePhotoFileId" TEXT,
    "status"              TEXT NOT NULL DEFAULT 'PENDING',
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobsReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JobsBlock" (
    "id"         TEXT NOT NULL,
    "blockerId"  TEXT NOT NULL,
    "blockedId"  TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobsBlock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobsBlock_blockerId_blockedId_key" ON "JobsBlock"("blockerId", "blockedId");

CREATE TABLE IF NOT EXISTS "JobsAdminMessage" (
    "id"         TEXT NOT NULL,
    "senderId"   TEXT NOT NULL,
    "text"       TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobsAdminMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JobsTransaction" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "amount"     DOUBLE PRECISION NOT NULL,
    "currency"   TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'COMPLETED',
    "txHash"     TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobsTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobsTransaction_txHash_key" ON "JobsTransaction"("txHash");

-- Foreign keys (added after all tables exist, IF NOT EXISTS via DO-block
-- since Postgres has no native "ADD CONSTRAINT IF NOT EXISTS").
DO $$ BEGIN
    ALTER TABLE "JobsProfile" ADD CONSTRAINT "JobsProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "JobsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "JobsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StoreListing" ADD CONSTRAINT "StoreListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "JobsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StoreWantedListing" ADD CONSTRAINT "StoreWantedListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "JobsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "JobsTransaction" ADD CONSTRAINT "JobsTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "JobsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Grants — required for Supabase's service_role to read/write these
-- tables (RLS bypass alone is not enough, an explicit GRANT is required).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "JobsUser" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "JobsProfile" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "JobPosting" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StoreListing" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StoreWantedListing" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StoreOrder" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "JobsDispute" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "JobsReport" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "JobsBlock" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "JobsAdminMessage" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "JobsTransaction" TO service_role;
