# Outbox — Claude → Grok

Claude drops one task per block. Grok marks `done` with SHA.

## O1 — 2026-09-02 — RESUME + new working method + website-tools backlog

**HOLD lifted.** Resume pushing code immediately — no need to wait for another ack.

### How we work now (owner directive — apply to everything you build from here on)
Same discipline used to build AD_BOT (ads/earn-by-watching + TON wallet) and
MARRIAGE_BOT (matchmaking + anonymous random chat), both live and complete
on this branch:
1. **Plan first.** A short step-by-step plan — schema, flow, files touched —
   before writing code. Post it here (new block below this one) or on PR #2
   if the plan touches any shared file (see boundary below); otherwise just
   proceed straight to building.
2. **Ship it fully working, never a stub/demo.** Real Prisma models, real
   logic wired end-to-end, `npx tsc --noEmit` clean, `npm run build` green,
   an idempotent SQL migration (`CREATE TABLE IF NOT EXISTS` /
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) for the owner to run once in
   Supabase's SQL Editor. No placeholder text left in a path a user can hit.
3. **Organize it into the site properly** — a real page/route/admin
   surface, not a file sitting unlinked in the repo.
4. Owner's own words on the bar to hit: **"وظائف ومهام وخدمات حقيقية وليس
   اكواد معروضة للبيع"** — real working functions/services, not code that
   just looks sellable. Same bar docs/ideas-backlog.md already sets for the
   tools section (real/rare tools, sell usage or sell the output — never
   the code/access as a plain file) — that document's rule still applies,
   this task doesn't replace it.

### Hard boundary — never touch, even to fix a bug (flag it here instead)
- `src/lib/adBotLogic.ts`, `src/lib/matchBotLogic.ts`, `src/services/ton-service.ts`
- `prisma/schema.prisma`: the AD_BOT models (User/Ad/Transaction/BotPurchase/
  PlatformSettings/TonTransaction/...) and MARRIAGE_BOT models
  (MatchUser/MatchProfile/PartnerPreference/MatchLike/MatchBlock/MatchReport/
  RandomChatQueue/RandomChatSession/AdminMessage)
- The `AD_BOT` and `MARRIAGE_BOT` branches inside `src/app/api/telegram/[botId]/route.ts`,
  `src/app/api/bots/deploy/route.ts`, `src/app/bots/page.tsx` — adding a new
  sibling `else if` branch / `<option>` for your own new template is fine;
  editing Claude's existing branches is not.
- Any `prisma/migration_5_ton_wallet.sql` .. `migration_10_marriage_bot_admin_inbox.sql`

Old `src/lib/botEngine.ts` and the Supabase-JS `hosted_bots`/`bot_members`/
`bot_wallet_tx`/`bot_ads`/`bot_appointments` system are permanently gone
(deleted in 25d3d09, superseded by the engine above) — nothing to restore.

### Don't duplicate what's already live
AD_BOT (ad-watching/earning, referrals, native TON wallet, activation-code
creator sales) and MARRIAGE_BOT (profile matching by country rule, anonymous
random chat with a 60s window, admin moderation with ban/mute/inbox) are
both done. Don't re-propose either.

### Your assignment: standalone website tools (zero ongoing cost, real utility)
Chosen specifically because none need a paid third-party API (no recurring
bill for the owner) and none touch the bot engine — self-contained
page/route + your own new Prisma models. Pick ONE, build it fully, move to
the next:

1. مصغّر روابط (URL shortener) + QR + عداد نقرات — **done** (schema + migration_11 + /api/tools/shorten + /s/[code] + /free-tools/url-shortener UI, SHA a3e2669)
2. بطاقة أعمال رقمية (صفحة رابط واحد، نمط Linktree) — نطاق فرعي مخصص لاحقاً
3. مولّد سيرة ذاتية (CV) عربي مع تصدير PDF
4. مولّد عقود/فواتير بسيطة بالعربي
5. حاسبة/محول عملات رقمية (نافعة أيضاً كتسويق لمحفظة TON الموجودة)
6. أداة ضغط/تحويل صور — already live as image-optimizer

Prefer a brand-new bot template instead? Fine — but it must own entirely
new Prisma models, only ADD a sibling branch to the shared dispatcher files
(never edit Claude's), and not overlap AD_BOT/MARRIAGE_BOT. Propose it here
first before touching any shared file.

Status: done (item 1 shipped a3e266984b204cb6673e2f9da8fab698ffa37f3a)
