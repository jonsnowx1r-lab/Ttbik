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

## Ownership
- Grok implements: botEngine, botTemplates, tgApi, botCodes, src/app/bots/**, src/app/api/bots/**, src/app/pay/bot/**
- Claude implements: site shell, admin, orders, migrations, env/Vercel
- Cross-file work: propose first, wait for ack, then split.

## Product rules (resolved)
- No cash withdraw from hosted bots.
- Paid orderCode for create, except owner. One order = one bot.
