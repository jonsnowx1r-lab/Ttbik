-- Site reorganization pass (owner directive, 2026-09-03: "رتب الادوات
-- والاسعار والمكتبات في اقسام"). Run once in Supabase's SQL Editor, after
-- the earlier migration files. Idempotent.

-- 1) "أعلن في قناتنا" (channel-ad-slot, $8) got swept into the blanket
--    "code-only services" deactivation in pending_migration.sql — but it's
--    not a code-for-sale product, it's a real deliverable (we post the
--    customer's ad in our own Telegram channel within 24h). Reactivate it.
update services set is_active = true where slug = 'channel-ad-slot';

-- 2) "automation-sites" has zero services left in it at all (every one of
--    its 4 products was hard-deleted as locked code — see
--    migration_hard_delete_locked_code_products.sql). An orphaned, always-
--    empty category row serves no purpose; remove it. (services.category_id
--    is "on delete cascade", but there is nothing left under this category
--    to cascade — verified above.)
delete from categories where slug = 'automation-sites';

-- Note: "ai-translation" and "content-design" also have zero ACTIVE
-- services right now (all their services were deactivated on 2026-08-30 as
-- a deliberate, reversible decision — "anyone can get the same output free
-- from any AI" — see pending_migration.sql's comment on that UPDATE). That
-- decision is left as-is here since it's a separate call from today's
-- cleanup; both categories are already hidden from the homepage (see
-- src/app/page.tsx's `visible` filter) so a visitor never sees an empty
-- tab. Ask the owner before deleting these two categories/services for
-- real — unlike the locked-code batch, they were deliberately kept
-- reversible in case that decision changes.
