-- NOVA AI — the owner's $0-cost AI assistant product (owner spec,
-- 2026-09-05). Shared identity + quota/subscription ledger only — the
-- actual AI logic lives in a separate Python FastAPI service (ai-system/)
-- that talks to these same tables directly via supabase-py. Fully
-- isolated from every other bot's tables. Run once in Supabase's SQL
-- Editor. Idempotent.

CREATE TABLE IF NOT EXISTS "NovaUser" (
    "id"                    TEXT NOT NULL,
    "telegramId"            TEXT,
    "email"                 TEXT,
    "apiKey"                TEXT,
    "plan"                  TEXT NOT NULL DEFAULT 'FREE',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "dailyUsed"             INTEGER NOT NULL DEFAULT 0,
    "dailyResetAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovaUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NovaUser_telegramId_key" ON "NovaUser"("telegramId");
CREATE UNIQUE INDEX IF NOT EXISTS "NovaUser_email_key" ON "NovaUser"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "NovaUser_apiKey_key" ON "NovaUser"("apiKey");

CREATE TABLE IF NOT EXISTS "NovaUsageLog" (
    "id"         TEXT NOT NULL,
    "novaUserId" TEXT NOT NULL,
    "channel"    TEXT NOT NULL,
    "queryType"  TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovaUsageLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NovaUsageLog_novaUserId_idx" ON "NovaUsageLog"("novaUserId");

CREATE TABLE IF NOT EXISTS "NovaSubscription" (
    "id"         TEXT NOT NULL,
    "novaUserId" TEXT NOT NULL,
    "plan"       TEXT NOT NULL,
    "amountUsd"  DOUBLE PRECISION NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedBy" TEXT,
    "startedAt"  TIMESTAMP(3),
    "expiresAt"  TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovaSubscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NovaSubscription_novaUserId_idx" ON "NovaSubscription"("novaUserId");

-- Foreign keys (IF NOT EXISTS via DO-block, same pattern as every other
-- migration here). Both child tables are structurally owned by
-- NovaUser, so both get a real FK (unlike the transactional/log tables
-- in some other bots that intentionally skip one).
DO $$ BEGIN
    ALTER TABLE "NovaUsageLog" ADD CONSTRAINT "NovaUsageLog_novaUserId_fkey" FOREIGN KEY ("novaUserId") REFERENCES "NovaUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "NovaSubscription" ADD CONSTRAINT "NovaSubscription_novaUserId_fkey" FOREIGN KEY ("novaUserId") REFERENCES "NovaUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Grants — required for Supabase's service_role to read/write these
-- tables (both Next.js/Prisma AND the separate Python FastAPI service
-- use the service_role key against this same project).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "NovaUser" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "NovaUsageLog" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "NovaSubscription" TO service_role;
