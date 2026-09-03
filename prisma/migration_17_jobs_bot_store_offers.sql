-- JOBS_BOT — StoreOffer: price negotiation on either a StoreListing (buyer
-- proposes a price) or a StoreWantedListing (seller proposes to fulfill a
-- buy request), owner spec 2026-09-06. Run once in Supabase's SQL Editor.
-- Idempotent.

CREATE TABLE IF NOT EXISTS "StoreOffer" (
    "id"          TEXT NOT NULL,
    "kind"        TEXT NOT NULL, -- LISTING | WANTED
    "listingId"   TEXT,
    "wantedId"    TEXT,
    "buyerId"     TEXT NOT NULL,
    "sellerId"    TEXT NOT NULL,
    "price"       DOUBLE PRECISION NOT NULL,
    "lastOfferBy" TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | ACCEPTED | REJECTED
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOffer_pkey" PRIMARY KEY ("id")
);

-- Grant — required for Supabase's service_role to read/write this table
-- (RLS bypass alone is not enough, an explicit GRANT is required).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StoreOffer" TO service_role;
