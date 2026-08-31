-- Adds BotPurchase — the $100 "أريد بوتاً مماثلاً" gated activation flow.
-- Run once in Supabase → SQL Editor → New query → Run.

CREATE TABLE IF NOT EXISTS "BotPurchase" (
    "id"                TEXT NOT NULL,
    "buyerId"           TEXT NOT NULL,
    "code"              TEXT,
    "amount"            DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "status"            TEXT NOT NULL DEFAULT 'PENDING',
    "transferReference" TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BotPurchase_code_key" ON "BotPurchase"("code");
