-- Hosted Telegram bots on Ttbik. Run in Supabase SQL editor once.

create table if not exists public.hosted_bots (
  id uuid primary key default gen_random_uuid(),
  public_code text unique not null,
  template_type text not null,
  bot_token text not null,
  bot_username text,
  bot_tg_id text,
  owner_contact text not null,
  welcome_text text,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  webhook_secret text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_members (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  tg_user_id text not null,
  username text,
  display_name text,
  points integer not null default 0,
  unique (bot_id, tg_user_id)
);

create table if not exists public.bot_wallet_tx (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  tg_user_id text not null,
  kind text not null,
  amount numeric not null,
  status text not null default 'pending',
  payment_method text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_ads (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  title text not null,
  reward_points integer not null default 1,
  is_active boolean not null default true
);

create table if not exists public.bot_appointments (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.hosted_bots(id) on delete cascade,
  tg_user_id text not null,
  display_name text,
  slot_label text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.hosted_bots enable row level security;
alter table public.bot_members enable row level security;
alter table public.bot_wallet_tx enable row level security;
alter table public.bot_ads enable row level security;
alter table public.bot_appointments enable row level security;
