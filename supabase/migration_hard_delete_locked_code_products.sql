-- Owner directive (2026-09-03): the 6 locked-code-for-sale products
-- retired to is_active=false in migration_remove_locked_code_products.sql
-- were NEVER purchased by anyone (owner-confirmed) — permanently DELETE
-- them instead of leaving dead rows around. Run once in Supabase's SQL
-- Editor, after that earlier migration. Idempotent (no-op if already gone).
--
-- Safety net: orders.service_id is "on delete restrict". If the owner's
-- assertion turns out to be wrong for any one of these — some historical
-- order actually does reference it — this statement fails loudly for that
-- row instead of silently orphaning/corrupting an order record. If it
-- fails, tell Claude which slug it failed on instead of forcing it through.
delete from services
where slug in (
  'order-manager-bot', 'ad-slot-bot', 'landing-page-generator',
  'workflow-templates', 'invoice-generator', 'whatsapp-catalog'
);
