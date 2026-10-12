-- Additive, private employer workspace. No existing workers or payments are changed.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create table public.employer_workspace_orders (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  amount integer not null default 29900 check (amount = 29900),
  currency text not null default 'dop' check (currency = 'dop'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  access_until timestamptz,
  check ((status = 'paid' and paid_at is not null and access_until is not null)
    or (status <> 'paid' and access_until is null))
);
create index employer_workspace_orders_owner_status_idx
  on public.employer_workspace_orders(owner_user_id, status, access_until desc);
create unique index employer_workspace_one_pending_idx
  on public.employer_workspace_orders(owner_user_id) where status = 'pending';

create table public.employer_workspace_candidates (
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, worker_id)
);
create table public.employer_workspace_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  details text not null default '' check (char_length(details) <= 1200),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
create index employer_workspace_requests_owner_idx
  on public.employer_workspace_requests(owner_user_id, created_at desc);

create table public.employer_workspace_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  request_id uuid references public.employer_workspace_requests(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index employer_workspace_contacts_owner_idx
  on public.employer_workspace_contacts(owner_user_id, created_at desc);

-- Private service-role access only; the API verifies the Supabase Auth user
-- and enforces a paid, unexpired entitlement before returning workspace data.
alter table public.employer_workspace_orders enable row level security;
alter table public.employer_workspace_candidates enable row level security;
alter table public.employer_workspace_requests enable row level security;
alter table public.employer_workspace_contacts enable row level security;
revoke all on public.employer_workspace_orders from anon, authenticated;
revoke all on public.employer_workspace_candidates from anon, authenticated;
revoke all on public.employer_workspace_requests from anon, authenticated;
revoke all on public.employer_workspace_contacts from anon, authenticated;
grant all on public.employer_workspace_orders to service_role;
grant all on public.employer_workspace_candidates to service_role;
grant all on public.employer_workspace_requests to service_role;
grant all on public.employer_workspace_contacts to service_role;

comment on table public.employer_workspace_contacts is
  'Private record that an employer prepared a WhatsApp handoff; never evidence that a message was sent or answered.';
commit;
