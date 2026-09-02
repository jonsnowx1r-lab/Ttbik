-- Native TON custodial wallet additions (owner spec, 2026-09-02) — a
-- second, direct deposit/withdrawal path alongside NOWPayments, not a
-- replacement for it. Run once in Supabase SQL Editor.

-- User.tonMemo: unique per-user memo/comment used to attribute a deposit
-- sent to the platform's single shared hot wallet to the right user.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tonMemo" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_tonMemo_key" ON "User"("tonMemo");

-- Transaction.destination: withdrawal payout address (TRC20/TON/etc),
-- persisted so decideWithdrawal knows where to actually send funds on
-- approval instead of relying on a one-time admin notification message.
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "destination" TEXT;

-- TonTransaction: blockchain-level ledger for native TON/USDT-TON
-- transfers — the idempotency source for the deposit scanner (unique per
-- on-chain txHash) and the audit record of what was signed/broadcast for
-- a withdrawal.
CREATE TABLE IF NOT EXISTS "TonTransaction" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "amountTon"  DOUBLE PRECISION NOT NULL,
    "usdValue"   DOUBLE PRECISION NOT NULL,
    "txHash"     TEXT NOT NULL,
    "toAddress"  TEXT,
    "status"     TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TonTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TonTransaction_txHash_key" ON "TonTransaction"("txHash");

DO $$ BEGIN
    ALTER TABLE "TonTransaction" ADD CONSTRAINT "TonTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
