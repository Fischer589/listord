-- Private, account-linked one-time contact purchases. No existing orders change.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create table public.employer_direct_contact_orders (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_paid_event_id text unique,
  stripe_reversal_event_id text unique,
  amount integer not null default 8900 check (amount = 8900),
  currency text not null default 'dop' check (currency = 'dop'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'disputed', 'revoked')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (status <> 'paid' or (paid_at is not null and stripe_payment_intent_id is not null))
);
create index employer_direct_contact_owner_worker_idx
  on public.employer_direct_contact_orders(owner_user_id, worker_id, status);
create unique index employer_direct_contact_one_pending_idx
  on public.employer_direct_contact_orders(owner_user_id, worker_id) where status = 'pending';

alter table public.employer_direct_contact_orders enable row level security;
revoke all on public.employer_direct_contact_orders from anon, authenticated;
grant all on public.employer_direct_contact_orders to service_role;
comment on table public.employer_direct_contact_orders is
  'Private single-worker contact purchases. Paid rows authorize only their owner and worker while contact remains eligible.';
commit;
