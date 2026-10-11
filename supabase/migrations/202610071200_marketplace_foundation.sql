-- ListoRD 2.0 / Phase 1B. Additive only. Review live schema and dependencies.
-- No legacy leads are published, no workers changed, no payments touched.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create table public.marketplace_opportunities (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'limpieza', 'cocina', 'plomeria', 'electricidad', 'construccion', 'pintura',
    'clases', 'belleza', 'jardineria', 'conductor', 'ninos', 'cuidadora', 'carpinteria', 'seguridad'
  )),
  city text not null check (char_length(btrim(city)) between 2 and 100),
  general_zone text check (char_length(general_zone) <= 100),
  scope text not null check (char_length(btrim(scope)) between 10 and 1200),
  schema_version integer not null default 1 check (schema_version = 1),
  specification jsonb not null default '{}'::jsonb
    check (jsonb_typeof(specification) = 'object' and octet_length(specification::text) <= 16000),
  starts_at timestamptz,
  timing_note text check (char_length(timing_note) <= 200),
  duration_minutes integer check (duration_minutes > 0 and duration_minutes <= 525600),
  duration_note text check (char_length(duration_note) <= 200),
  compensation_kind text not null check (compensation_kind in ('fixed', 'budget', 'negotiable')),
  compensation_min numeric(12,2) check (compensation_min > 0),
  compensation_max numeric(12,2) check (compensation_max > 0),
  compensation_unit text check (compensation_unit in ('hour', 'day', 'week', 'month', 'task')),
  currency text not null default 'DOP' check (currency = 'DOP'),
  status text not null default 'draft' check (status in ('draft', 'open', 'filled', 'expired', 'closed')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  published_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (compensation_max is null or (compensation_min is not null and compensation_max >= compensation_min)),
  check (
    (compensation_kind = 'negotiable' and compensation_min is null and compensation_max is null)
    or (compensation_kind in ('fixed', 'budget') and compensation_min is not null and compensation_unit is not null)
  ),
  check (status <> 'open' or (
    moderation_status = 'approved' and published_at is not null
    and (starts_at is not null or char_length(btrim(coalesce(timing_note, ''))) > 0)
    and (duration_minutes is not null or char_length(btrim(coalesce(duration_note, ''))) > 0)
  ))
);

comment on table public.marketplace_opportunities is
  'Public-safe opportunity projection. Application must validate versioned category answers and moderate for private information before publication. No residential addresses or phone numbers.';

create table public.marketplace_opportunity_owners (
  opportunity_id uuid primary key references public.marketplace_opportunities(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 100),
  whatsapp_number text not null check (whatsapp_number ~ '^[1-9][0-9]{9,14}$'),
  publication_consent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_user_id, idempotency_key)
);

comment on table public.marketplace_opportunity_owners is
  'Private verified ownership and contact data. Never infer ownership from an unverified phone or browser ID. Explicit consent is required by the publishing service.';

create table public.marketplace_interests (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.marketplace_opportunities(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  decision text not null check (decision in ('interested', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, worker_id)
);

comment on table public.marketplace_interests is
  'Private decisions, not accepted jobs or hires. Server verifies worker ownership and open/non-expired opportunity under transaction lock before writes.';

create table public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.marketplace_opportunities(id) on delete restrict,
  worker_id uuid references public.workers(id) on delete restrict,
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (reason in ('spam', 'misleading', 'unsafe', 'privacy', 'other')),
  detail text check (char_length(detail) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(opportunity_id, worker_id) = 1)
);

create index marketplace_open_search_idx on public.marketplace_opportunities
  (category, city, created_at desc, id) where status = 'open' and moderation_status = 'approved';
create index marketplace_expiry_idx on public.marketplace_opportunities (expires_at) where status = 'open';
create index marketplace_owner_idx on public.marketplace_opportunity_owners (owner_user_id, created_at desc);
create index marketplace_interest_worker_idx on public.marketplace_interests (worker_id, created_at desc);
create index marketplace_report_queue_idx on public.marketplace_reports (status, created_at);

create function public.marketplace_guard_publication() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'open' and not exists (
    select 1 from public.marketplace_opportunity_owners o
    where o.opportunity_id = new.id and o.publication_consent_at is not null
  ) then
    raise exception 'Verified owner and publication consent required';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger marketplace_guard_publication
before insert or update on public.marketplace_opportunities
for each row execute function public.marketplace_guard_publication();

create function public.marketplace_guard_interest() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Serialize new decisions with lifecycle changes; no interest on expired work.
  if new.decision = 'interested' then
    perform 1 from public.marketplace_opportunities
    where id = new.opportunity_id and status = 'open'
      and moderation_status = 'approved' and expires_at > now()
    for update;
    if not found then raise exception 'Opportunity is not open'; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger marketplace_guard_interest
before insert or update on public.marketplace_interests
for each row execute function public.marketplace_guard_interest();

revoke all on function public.marketplace_guard_publication() from public;
revoke all on function public.marketplace_guard_interest() from public;

alter table public.marketplace_opportunities enable row level security;
alter table public.marketplace_opportunity_owners enable row level security;
alter table public.marketplace_interests enable row level security;
alter table public.marketplace_reports enable row level security;

-- Explicit ACLs also neutralize Supabase's permissive default table grants.
revoke all on public.marketplace_opportunities, public.marketplace_opportunity_owners,
  public.marketplace_interests, public.marketplace_reports from public, anon, authenticated;
grant select on public.marketplace_opportunities to anon, authenticated;
grant all on public.marketplace_opportunities, public.marketplace_opportunity_owners,
  public.marketplace_interests, public.marketplace_reports to service_role;

create policy marketplace_browse_open on public.marketplace_opportunities
  for select to anon, authenticated
  using (status = 'open' and moderation_status = 'approved' and expires_at > now());

-- Private entities have no public/authenticated policies or direct grants.
-- Their service-role consumers MUST verify identity and authorization separately.
commit;
