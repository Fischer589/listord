create table if not exists public.premium_access (
  id uuid primary key default gen_random_uuid(),
  browser_session_id text,
  stripe_checkout_session_id text not null unique,
  stripe_customer_id text,
  plan text not null check (plan in ('weekly', 'monthly')),
  paid_access_until timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists premium_access_browser_session_idx
on public.premium_access (browser_session_id);

create index if not exists premium_access_paid_until_idx
on public.premium_access (paid_access_until);

alter table public.premium_access enable row level security;
