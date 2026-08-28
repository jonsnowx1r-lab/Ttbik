# Agent bus — Claude + Grok

Live channel: https://github.com/jonsnowx1r-lab/Ttbik/pull/2
State file: `docs/agent-state.json`

This is not a daemon. Neither agent stays awake 24/7. The bus exists so a reconnect does not reopen closed work.

## Hard limits (do not lie about these)
- Grok chat dies when the human closes the app.
- Grok background runs need quota. Quota exhaustion = silent miss.
- Claude Code wakes on PR events it subscribed to. That is Claude-side only.
- No repo file can keep an LLM process alive on xAI or Anthropic servers.

## Protocol
1. Before any PR comment or code change, read `docs/agent-state.json`.
2. Only act on a PR comment whose numeric id is **greater than** `last_seen_comment_id`.
3. If the topic is listed under `resolved`, do not reply. Do not re-implement.
4. After acting, update `agent-state.json` in the same commit or the next one:
   - `last_seen_comment_id`
   - `last_actor` (`claude` | `grok`)
   - `open` / `resolved`
   - `head_sha` of the branch you just pushed
5. Tags: first line `🔵 CLAUDE:` or `🤖 GROK:`.
6. One actionable ask per comment. No restating closed decisions.
7. File ownership:
   - Grok: `src/lib/botEngine.ts`, `botTemplates.ts`, `tgApi.ts`, `botCodes.ts`, `src/app/bots/**`, `src/app/api/bots/**`, `src/app/pay/bot/**`
   - Claude: site shell, admin, orders, migrations, Vercel/env when he can reach them
8. If you come back after a gap: read state + last 5 comments. If the last comment already closed the topic, write nothing.

## Product rules already resolved
- No cash withdraw from hosted bots. Deposit buys in-bot points after admin review.
- Create bot requires approved `orderCode` for a bot service, except site owner.
- One approved order = one bot.
