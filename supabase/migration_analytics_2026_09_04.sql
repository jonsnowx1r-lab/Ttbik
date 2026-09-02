-- Owner directive (2026-09-04): admin-only visitor analytics — "اداة تحليل
-- زوار الصفحة... لي فقط للادمن". Self-hosted in the same Supabase project
-- (no third-party analytics account, no recurring cost). Run once in
-- Supabase's SQL Editor. Idempotent.
--
-- Deliberately does NOT store the visitor's raw IP address or full
-- user-agent string — only a derived device_type category — same
-- PII-conscious posture as the rest of this project (see orders' "no
-- public SELECT policy" comment in schema.sql). No geography either, to
-- avoid a third-party IP-geolocation dependency; can be added later if
-- actually needed.

create table if not exists page_views (
  id          uuid primary key default gen_random_uuid(),
  path        text not null,
  referrer    text,
  device_type text not null default 'unknown', -- 'mobile' | 'desktop' | 'tablet' | 'unknown'
  session_id  text not null, -- random id the visitor's browser keeps in localStorage, NOT tied to any account/identity
  created_at  timestamptz not null default now()
);

create index if not exists idx_page_views_created_at on page_views (created_at desc);
create index if not exists idx_page_views_path on page_views (path);
create index if not exists idx_page_views_session on page_views (session_id);

-- RLS enabled with zero policies = default-deny for anon/authenticated
-- entirely. Only service_role touches this table, and only from this
-- project's own server routes (POST /api/analytics/track to write, the
-- admin-only aggregate functions below to read) — never the browser
-- directly, so no anon policy is needed at all, unlike orders/services.
alter table page_views enable row level security;
grant select, insert on public.page_views to service_role;

-- ---------------------------------------------------------------------------
-- Aggregate functions — all the counting happens in Postgres, not by
-- fetching raw rows into the app server. security definer + a locked-down
-- EXECUTE grant (service_role only) since these still summarize visitor
-- behavior even though they return no PII.
-- ---------------------------------------------------------------------------

create or replace function analytics_totals()
returns table (
  total_views bigint, total_unique bigint,
  views_24h bigint, unique_24h bigint,
  views_7d bigint, unique_7d bigint,
  views_30d bigint, unique_30d bigint
)
language sql
security definer
set search_path = public
as $$
  select
    count(*), count(distinct session_id),
    count(*) filter (where created_at >= now() - interval '24 hours'),
    count(distinct session_id) filter (where created_at >= now() - interval '24 hours'),
    count(*) filter (where created_at >= now() - interval '7 days'),
    count(distinct session_id) filter (where created_at >= now() - interval '7 days'),
    count(*) filter (where created_at >= now() - interval '30 days'),
    count(distinct session_id) filter (where created_at >= now() - interval '30 days')
  from page_views;
$$;

create or replace function analytics_top_pages(days_back int default 30, limit_n int default 10)
returns table (path text, views bigint, unique_visitors bigint)
language sql
security definer
set search_path = public
as $$
  select path, count(*), count(distinct session_id)
  from page_views
  where created_at >= now() - (days_back || ' days')::interval
  group by path
  order by count(*) desc
  limit limit_n;
$$;

create or replace function analytics_top_referrers(days_back int default 30, limit_n int default 10)
returns table (referrer text, views bigint)
language sql
security definer
set search_path = public
as $$
  select referrer, count(*)
  from page_views
  where referrer is not null and referrer <> ''
    and created_at >= now() - (days_back || ' days')::interval
  group by referrer
  order by count(*) desc
  limit limit_n;
$$;

create or replace function analytics_device_breakdown(days_back int default 30)
returns table (device_type text, views bigint)
language sql
security definer
set search_path = public
as $$
  select device_type, count(*)
  from page_views
  where created_at >= now() - (days_back || ' days')::interval
  group by device_type
  order by count(*) desc;
$$;

create or replace function analytics_daily(days_back int default 14)
returns table (day date, views bigint, unique_visitors bigint)
language sql
security definer
set search_path = public
as $$
  select date_trunc('day', created_at)::date as day, count(*), count(distinct session_id)
  from page_views
  where created_at >= now() - (days_back || ' days')::interval
  group by 1
  order by 1;
$$;

revoke all on function analytics_totals() from public;
revoke all on function analytics_top_pages(int, int) from public;
revoke all on function analytics_top_referrers(int, int) from public;
revoke all on function analytics_device_breakdown(int) from public;
revoke all on function analytics_daily(int) from public;
grant execute on function analytics_totals() to service_role;
grant execute on function analytics_top_pages(int, int) to service_role;
grant execute on function analytics_top_referrers(int, int) to service_role;
grant execute on function analytics_device_breakdown(int) to service_role;
grant execute on function analytics_daily(int) to service_role;
