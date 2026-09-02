# Agent bus — Claude + Grok

Live channel: https://github.com/jonsnowx1r-lab/Ttbik/pull/2
State: `docs/agent-state.json`
Inbox (Grok → Claude while Grok is offline): `docs/agent-inbox.md`
Outbox (Claude → Grok while Grok is offline): `docs/agent-outbox.md`

Not a daemon. Files persist work across disconnects. That is the retrospective link.

## Cycle (every scheduled Grok run)
1. Read `agent-state.json`, `agent-outbox.md`, last 8 PR #2 comments.
2. Ignore comment ids ≤ `last_seen_comment_id` and anything in `resolved`.
3. If outbox has an open task in Grok files: implement it, push, mark done in outbox + state.
4. If no outbox task: pick ONE open site improvement from `open` or invent one small paid tool idea, write a short proposal in inbox + one PR comment.
5. If a proposal is already waiting with no Claude ack: do not spam. Stop.
6. Update `last_seen_comment_id` and `updated_at` even when you only read.

## Ownership (updated 2026-09-02 after the Prisma+grammy rebuild — supersedes the block below)
- Claude owns and is the sole editor of the whole bot engine: `prisma/schema.prisma`
  (AD_BOT + MARRIAGE_BOT models), `src/lib/adBotLogic.ts`, `src/lib/matchBotLogic.ts`,
  `src/services/ton-service.ts`, `src/app/api/telegram/[botId]/route.ts`,
  `src/app/api/bots/deploy/route.ts`, `src/app/bots/page.tsx`, every
  AD_BOT/MARRIAGE_BOT `prisma/migration_*.sql` — plus site shell, admin, orders,
  migrations, env/Vercel as before.
- Grok implements: new standalone website tools (own page/route + own new
  Prisma models, per docs/agent-outbox.md task O1), or a brand-new bot
  template that only ADDS a sibling branch to the shared dispatcher files
  above — never edits Claude's existing branches.
- Claude supervises: any change to a file Claude owns needs a plan proposed
  in agent-outbox.md/agent-inbox.md or PR #2 first, then Claude's ack,
  before Grok pushes to it.
- Cross-file work: propose first, wait for ack, then split.

### Historical (pre-rebuild — botEngine.ts and hosted_bots no longer exist, kept for reference only)
- Grok implements: botEngine, botTemplates, tgApi, botCodes, src/app/bots/**, src/app/api/bots/**, src/app/pay/bot/**
- Claude implements: site shell, admin, orders, migrations, env/Vercel

## Product rules (resolved)
- No cash withdraw from hosted bots.
- Paid orderCode for create, except owner. One order = one bot.
- **AD_BOT and MARRIAGE_BOT are never sold or self-served on the website
  (owner directive, 2026-09-03).** No public price, no catalog listing, no
  automated checkout — ever — for these two templates. Selling free/instant
  self-service access to them "بمجرد دفع مبلغ صغير" harms the business
  (owner's own words). They stay reachable ONLY the way they already are:
  AD_BOT via the in-bot "أريد بوتاً مماثلاً" button → $100 manual bank
  transfer → owner's manual approval → per-buyer BotPurchase code;
  MARRIAGE_BOT via a password the owner hands out personally. Price and
  payment for both are negotiated/settled manually, off-platform, by the
  owner — don't build an on-site price, an automated payment path, or an
  activation code that isn't gated by owner approval for either template.
  This is why `hosted-bot-builder` was retired (see
  migration_remove_locked_code_products.sql §2b) rather than fixed to
  auto-deliver — auto-delivery is the thing that must never exist here.
- Neither template's source/build is exposed anywhere for download/copy —
  keep it that way (unlike the free FAQ/auto-reply bots, which deliberately
  ship full source). Before adding any admin/debug/export endpoint that
  touches Bot rows, make sure it can't leak a working AD_BOT/MARRIAGE_BOT
  token, template code, or webhook secret to anyone but the owner.
- Locked-code-for-sale catalog products (order-manager-bot, ad-slot-bot,
  landing-page-generator, workflow-templates, invoice-generator,
  whatsapp-catalog) are permanently deleted, not just deactivated — the
  site sells real services, not locked code (owner directive, 2026-09-02).
  Don't re-add a "buy this code file" product.
