-- Platform-profit sweep-to-owner-wallet accumulator (owner spec,
-- 2026-09-02). Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS "PlatformSettings" (
    "id"                     INTEGER NOT NULL DEFAULT 1,
    "accumulatedOwnerProfit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updatedAt"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
