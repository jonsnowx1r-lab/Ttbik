-- Adds AdClick, the per-user click/timer table backing the "زيارة الموقع
-- (15 ثانية)" anti-cheat gate on non-Telegram ads in the InlineKeyboard
-- carousel. Run once in Supabase SQL Editor.

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
