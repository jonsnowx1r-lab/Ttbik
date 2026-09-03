-- MARRIAGE_BOT's own financial ledger (owner spec, 2026-09-05) — fully
-- separate from AD_BOT's User/Transaction/TonTransaction tables. Reusing
-- those would have meant a MARRIAGE_BOT deposit crediting the exact same
-- balance as any AD_BOT the same Telegram user has elsewhere (both
-- NOWPayments' webhook and the TON scanner key purely off Telegram ID).
-- Run once in Supabase's SQL Editor. Idempotent.

ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE "MatchUser" ADD COLUMN IF NOT EXISTS "tonMemo" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MatchUser_tonMemo_key" ON "MatchUser"("tonMemo");

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
