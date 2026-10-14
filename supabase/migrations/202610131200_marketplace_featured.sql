-- Additive, service-only ledger for one-time, seven-day featured opportunities.
-- No existing opportunity, worker, workspace, or payment row is changed.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create table public.marketplace_featured_orders (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.marketplace_opportunities(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_paid_event_id text unique,
  stripe_refund_event_id text unique,
  amount integer not null default 14900 check (amount = 14900),
  currency text not null default 'dop' check (currency = 'dop'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  featured_until timestamptz,
  check ((status = 'paid' and paid_at is not null and featured_until = paid_at + interval '168 hours')
    or (status <> 'paid' and featured_until is null))
);
create unique index marketplace_featured_one_pending_idx
  on public.marketplace_featured_orders(opportunity_id) where status = 'pending';
create index marketplace_featured_active_idx
  on public.marketplace_featured_orders(status, featured_until desc, opportunity_id);
create index marketplace_featured_owner_idx
  on public.marketplace_featured_orders(owner_user_id, created_at desc);

alter table public.marketplace_featured_orders enable row level security;
revoke all on public.marketplace_featured_orders from public, anon, authenticated;
grant all on public.marketplace_featured_orders to service_role;

create function public.marketplace_featured_reserve(p_actor uuid, p_opportunity uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare existing uuid; created uuid;
begin
  perform 1 from public.marketplace_opportunities o
    join public.marketplace_opportunity_owners owner on owner.opportunity_id = o.id
    where o.id = p_opportunity and owner.owner_user_id = p_actor
      and owner.publication_consent_at is not null
      and o.status = 'open' and o.moderation_status = 'approved'
      and o.expires_at > now() + interval '7 days'
    for update of o;
  if not found then raise exception 'NOT_ELIGIBLE'; end if;
  if exists(select 1 from public.marketplace_featured_orders
      where opportunity_id = p_opportunity and status = 'paid' and featured_until > now()) then
    raise exception 'ALREADY_FEATURED';
  end if;
  select id into existing from public.marketplace_featured_orders
    where opportunity_id = p_opportunity and status = 'pending' limit 1;
  if existing is not null then return existing; end if;
  insert into public.marketplace_featured_orders(opportunity_id, owner_user_id)
    values(p_opportunity, p_actor) returning id into created;
  return created;
end $$;

create function public.marketplace_featured_paid(
  p_order uuid, p_session text, p_intent text, p_event text, p_paid_at timestamptz
) returns text
language plpgsql security definer set search_path = '' as $$
declare target public.marketplace_featured_orders; existing uuid;
begin
  select opportunity_id into existing from public.marketplace_featured_orders
    where id = p_order and stripe_session_id = p_session;
  if not found then raise exception 'ORDER_BINDING_REQUIRED'; end if;
  perform 1 from public.marketplace_opportunities where id = existing for update;
  select * into target from public.marketplace_featured_orders
    where id = p_order and stripe_session_id = p_session for update;
  if not found or p_intent is null or p_event is null or p_paid_at is null then
    raise exception 'INVALID_PAYMENT';
  end if;
  if target.status = 'refunded' then return 'refunded'; end if;
  if target.status = 'paid' then
    if target.stripe_payment_intent_id <> p_intent then raise exception 'PAYMENT_MISMATCH'; end if;
    return 'already_paid';
  end if;
  if exists(select 1 from public.marketplace_featured_orders
      where opportunity_id = target.opportunity_id and id <> p_order
        and status = 'paid' and featured_until > now()) then
    raise exception 'ALREADY_FEATURED';
  end if;
  update public.marketplace_featured_orders set
    status = 'paid', stripe_payment_intent_id = p_intent, stripe_paid_event_id = p_event,
    paid_at = p_paid_at, featured_until = p_paid_at + interval '168 hours'
    where id = p_order;
  return 'activated';
end $$;

create function public.marketplace_featured_fail(p_order uuid, p_session text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.marketplace_featured_orders set status = 'failed'
    where id = p_order and stripe_session_id is not distinct from p_session and status = 'pending';
  if not found and not exists(select 1 from public.marketplace_featured_orders
      where id = p_order and stripe_session_id is not distinct from p_session) then
    raise exception 'ORDER_BINDING_REQUIRED';
  end if;
end $$;

create function public.marketplace_featured_refund(
  p_order uuid, p_session text, p_intent text, p_event text
) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.marketplace_featured_orders;
begin
  select * into target from public.marketplace_featured_orders
    where id = p_order and stripe_session_id = p_session for update;
  if not found or p_intent is null or p_event is null then raise exception 'ORDER_BINDING_REQUIRED'; end if;
  if target.stripe_payment_intent_id is not null and target.stripe_payment_intent_id <> p_intent then
    raise exception 'PAYMENT_MISMATCH';
  end if;
  if target.status = 'refunded' then return; end if;
  update public.marketplace_featured_orders set
    status = 'refunded', stripe_payment_intent_id = p_intent,
    stripe_refund_event_id = p_event, featured_until = null
    where id = p_order;
end $$;

revoke all on function public.marketplace_featured_reserve(uuid,uuid),
  public.marketplace_featured_paid(uuid,text,text,text,timestamptz),
  public.marketplace_featured_fail(uuid,text),
  public.marketplace_featured_refund(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.marketplace_featured_reserve(uuid,uuid),
  public.marketplace_featured_paid(uuid,text,text,text,timestamptz),
  public.marketplace_featured_fail(uuid,text),
  public.marketplace_featured_refund(uuid,text,text,text)
  to service_role;
commit;
