-- MARRIAGE_BOT — تعارف وزواج شرعي (owner spec, 2026-09-02). Fully
-- independent tables from the AD_BOT schema above. Run once in
-- Supabase's SQL Editor.

CREATE TABLE IF NOT EXISTS "MatchUser" (
    "id"            TEXT NOT NULL,
    "botId"         TEXT NOT NULL,
    "phoneNumber"   TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "language"      TEXT NOT NULL DEFAULT 'ar',
    "pendingAction" JSONB,
    "lastActiveAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MatchProfile" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "gender"        TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "age"           INTEGER NOT NULL,
    "country"       TEXT NOT NULL,
    "job"           TEXT,
    "education"     TEXT,
    "attributes"    TEXT,
    "contactMethod" TEXT NOT NULL,
    "contactValue"  TEXT NOT NULL,
    "photoFileId"   TEXT,
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchProfile_userId_key" ON "MatchProfile"("userId");

CREATE TABLE IF NOT EXISTS "PartnerPreference" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "country"    TEXT NOT NULL,
    "ageMin"     INTEGER,
    "ageMax"     INTEGER,
    "job"        TEXT,
    "education"  TEXT,
    "attributes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PartnerPreference_userId_key" ON "PartnerPreference"("userId");

CREATE TABLE IF NOT EXISTS "MatchLike" (
    "id"         TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId"   TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchLike_fromUserId_toUserId_key" ON "MatchLike"("fromUserId", "toUserId");

CREATE TABLE IF NOT EXISTS "MatchBlock" (
    "id"         TEXT NOT NULL,
    "blockerId"  TEXT NOT NULL,
    "blockedId"  TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchBlock_blockerId_blockedId_key" ON "MatchBlock"("blockerId", "blockedId");

CREATE TABLE IF NOT EXISTS "MatchReport" (
    "id"         TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetId"   TEXT NOT NULL,
    "reason"     TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RandomChatQueue" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "botId"      TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'WAITING',
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "sessionId"  TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RandomChatQueue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RandomChatSession" (
    "id"         TEXT NOT NULL,
    "user1Id"    TEXT NOT NULL,
    "user2Id"    TEXT NOT NULL,
    "botId"      TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at"   TIMESTAMP(3),

    CONSTRAINT "RandomChatSession_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (added after all tables exist, IF NOT EXISTS via DO-block
-- since Postgres has no native "ADD CONSTRAINT IF NOT EXISTS").
DO $$ BEGIN
    ALTER TABLE "MatchProfile" ADD CONSTRAINT "MatchProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MatchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "PartnerPreference" ADD CONSTRAINT "PartnerPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MatchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MatchLike" ADD CONSTRAINT "MatchLike_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "MatchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MatchLike" ADD CONSTRAINT "MatchLike_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "MatchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MatchBlock" ADD CONSTRAINT "MatchBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "MatchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MatchBlock" ADD CONSTRAINT "MatchBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "MatchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MatchReport" ADD CONSTRAINT "MatchReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "MatchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MatchReport" ADD CONSTRAINT "MatchReport_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "MatchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "RandomChatQueue" ADD CONSTRAINT "RandomChatQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MatchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
