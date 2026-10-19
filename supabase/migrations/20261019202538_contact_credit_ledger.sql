-- Contact credits are private. Existing workspace and direct orders are untouched.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create table public.employer_contact_credit_orders (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  pack_size integer not null check (pack_size in (1,5,10)),
  amount integer not null,
  currency text not null default 'dop' check (currency = 'dop'),
  credits_remaining integer not null default 0 check (credits_remaining >= 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','disputed')),
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_paid_event_id text unique,
  stripe_reversal_event_id text unique,
  stripe_last_reversal_created bigint not null default 0,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  reversed_at timestamptz,
  check ((pack_size = 1 and amount = 10000) or (pack_size = 5 and amount = 44500) or (pack_size = 10 and amount = 89000)),
  check (credits_remaining <= pack_size),
  check (status <> 'paid' or (paid_at is not null and stripe_payment_intent_id is not null))
);
create index employer_credit_orders_owner_idx on public.employer_contact_credit_orders(owner_user_id,status,created_at);
create unique index employer_credit_one_pending_pack_idx
  on public.employer_contact_credit_orders(owner_user_id,pack_size) where status='pending';

create table public.employer_contact_credit_spends (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  order_id uuid not null references public.employer_contact_credit_orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(owner_user_id,worker_id,order_id)
);
create index employer_credit_spends_worker_idx on public.employer_contact_credit_spends(owner_user_id,worker_id);

-- Operator-created only after matching the historical Stripe purchase and
-- independently verifying the employer account. Browser IDs and phone numbers
-- alone never establish ownership of a legacy unlimited entitlement.
create table public.employer_legacy_entitlement_links (
  premium_access_id uuid primary key references public.premium_access(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  evidence_reference text not null check (char_length(btrim(evidence_reference)) >= 8),
  verified_at timestamptz not null default now()
);
create index employer_legacy_links_owner_idx on public.employer_legacy_entitlement_links(owner_user_id);

create table public.employer_contact_reveals (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index employer_contact_reveals_owner_time_idx on public.employer_contact_reveals(owner_user_id,created_at desc);

alter table public.employer_contact_credit_orders enable row level security;
alter table public.employer_contact_credit_spends enable row level security;
alter table public.employer_legacy_entitlement_links enable row level security;
alter table public.employer_contact_reveals enable row level security;
revoke all on public.employer_contact_credit_orders, public.employer_contact_credit_spends,
  public.employer_legacy_entitlement_links, public.employer_contact_reveals from public,anon,authenticated;
grant all on public.employer_contact_credit_orders, public.employer_contact_credit_spends,
  public.employer_legacy_entitlement_links, public.employer_contact_reveals to service_role;
grant usage, select on sequence public.employer_contact_reveals_id_seq to service_role;

-- Called only after server-side Supabase Auth verification. One SQL transaction
-- authorizes the worker, checks abuse caps, and spends exactly one credit.
create function public.authorize_worker_contact(p_owner uuid,p_worker uuid,p_prefix text,p_reveal boolean)
returns table(allowed boolean,source text,source_order uuid,remaining integer,already_unlocked boolean)
language plpgsql security definer set search_path = '' as $$
declare v_source text; v_order uuid; v_remaining integer; v_existing boolean := false;
begin
  if p_owner is null or p_worker is null or p_prefix not in ('cs_live_','cs_test_') or p_reveal is null then
    raise exception 'INVALID_CONTACT_REQUEST';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 736178));
  if not exists(select 1 from public.workers w where w.id=p_worker and w.is_verified
    and length(regexp_replace(coalesce(w.whatsapp_number,''),'[^0-9]','','g')) between 10 and 15) then
    return query select false,'unavailable'::text,null::uuid,0,false; return;
  end if;
  select id into v_order from public.employer_workspace_orders
    where owner_user_id=p_owner and status='paid' and access_until>now()
      and left(stripe_session_id,length(p_prefix))=p_prefix order by paid_at limit 1;
  if v_order is not null then v_source:='workspace'; v_existing:=true; end if;
  if v_order is null then
    select p.id into v_order from public.employer_legacy_entitlement_links l
      join public.premium_access p on p.id=l.premium_access_id
      where l.owner_user_id=p_owner and p.status='active' and p.paid_access_until>now()
        and left(p.stripe_checkout_session_id,length(p_prefix))=p_prefix
      order by p.paid_access_until desc limit 1;
    if v_order is not null then v_source:='legacy'; v_existing:=true; end if;
  end if;
  if v_order is null then
    select id into v_order from public.employer_direct_contact_orders
      where owner_user_id=p_owner and worker_id=p_worker and status='paid'
        and left(stripe_session_id,length(p_prefix))=p_prefix order by paid_at limit 1;
    if v_order is not null then v_source:='direct'; v_existing:=true; end if;
  end if;
  -- A logged contact made during a paid workspace term remains unlocked when
  -- that term ends. Reversed workspace orders never authorize this history.
  if v_order is null then
    select o.id into v_order from public.employer_workspace_contacts c
      join public.employer_workspace_orders o on o.owner_user_id=c.owner_user_id
        and o.status='paid' and o.paid_at<=c.created_at and o.access_until>c.created_at
        and left(o.stripe_session_id,length(p_prefix))=p_prefix
      where c.owner_user_id=p_owner and c.worker_id=p_worker
      order by c.created_at limit 1;
    if v_order is not null then v_source:='workspace'; v_existing:=true; end if;
  end if;
  if v_order is null then
    select s.order_id into v_order from public.employer_contact_credit_spends s
      join public.employer_contact_credit_orders o on o.id=s.order_id
      where s.owner_user_id=p_owner and s.worker_id=p_worker and o.status='paid'
        and left(o.stripe_session_id,length(p_prefix))=p_prefix order by s.created_at limit 1;
    if v_order is not null then v_source:='credit'; v_existing:=true; end if;
  end if;
  select coalesce(sum(o.credits_remaining),0)::integer into v_remaining
    from public.employer_contact_credit_orders o where o.owner_user_id=p_owner and o.status='paid'
      and left(o.stripe_session_id,length(p_prefix))=p_prefix;
  if v_order is null and v_remaining=0 then
    return query select false,'payment_required'::text,null::uuid,v_remaining,false; return;
  end if;
  if not p_reveal then
    return query select v_order is not null,coalesce(v_source,'credit_available'),v_order,v_remaining,v_existing; return;
  end if;
  -- Previously unlocked contacts remain accessible. Limit only newly revealed
  -- worker numbers, with room for normal high-volume hiring.
  if not v_existing and (
    (select count(distinct r.worker_id) from public.employer_contact_reveals r
       where r.owner_user_id=p_owner and r.created_at>now()-interval '1 hour') >= 50 or
    (select count(distinct r.worker_id) from public.employer_contact_reveals r
       where r.owner_user_id=p_owner and r.created_at>now()-interval '1 day') >= 200
  ) then
    return query select false,'rate_limited'::text,null::uuid,v_remaining,false; return;
  end if;
  if v_order is null then
    select o.id into v_order from public.employer_contact_credit_orders o
      where o.owner_user_id=p_owner and o.status='paid' and o.credits_remaining>0
        and left(o.stripe_session_id,length(p_prefix))=p_prefix order by o.paid_at,o.id limit 1 for update;
    if v_order is null then raise exception 'CREDIT_BALANCE_MISMATCH'; end if;
    update public.employer_contact_credit_orders set credits_remaining=credits_remaining-1 where id=v_order;
    insert into public.employer_contact_credit_spends(owner_user_id,worker_id,order_id)
      values(p_owner,p_worker,v_order);
    v_source:='credit'; v_remaining:=v_remaining-1;
  end if;
  insert into public.employer_contact_reveals(owner_user_id,worker_id) values(p_owner,p_worker);
  return query select true,v_source,v_order,v_remaining,v_existing;
end $$;
revoke all on function public.authorize_worker_contact(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.authorize_worker_contact(uuid,uuid,text,boolean) to service_role;

-- Account summary excludes phones and revoked purchases.
create function public.contact_credit_overview(p_owner uuid,p_prefix text)
returns table(remaining integer,unlocked jsonb,legacy_active boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null or p_prefix not in ('cs_live_','cs_test_') then raise exception 'INVALID_OVERVIEW'; end if;
  return query
  with valid_unlocks as (
    select d.worker_id from public.employer_direct_contact_orders d
      where d.owner_user_id=p_owner and d.status='paid'
        and left(d.stripe_session_id,length(p_prefix))=p_prefix
    union
    select s.worker_id from public.employer_contact_credit_spends s
      join public.employer_contact_credit_orders o on o.id=s.order_id
      where s.owner_user_id=p_owner and o.status='paid'
        and left(o.stripe_session_id,length(p_prefix))=p_prefix
    union
    select c.worker_id from public.employer_workspace_contacts c
      join public.employer_workspace_orders o on o.owner_user_id=c.owner_user_id
        and o.status='paid' and o.paid_at<=c.created_at and o.access_until>c.created_at
        and left(o.stripe_session_id,length(p_prefix))=p_prefix
      where c.owner_user_id=p_owner
  )
  select (select coalesce(sum(o.credits_remaining),0)::integer
      from public.employer_contact_credit_orders o where o.owner_user_id=p_owner
        and o.status='paid' and left(o.stripe_session_id,length(p_prefix))=p_prefix),
    coalesce((select jsonb_agg(jsonb_build_object('workerId',w.id,'name',w.full_name) order by w.full_name,w.id)
      from valid_unlocks u join public.workers w on w.id=u.worker_id and w.is_verified), '[]'::jsonb),
    exists(select 1 from public.employer_legacy_entitlement_links l
      join public.premium_access p on p.id=l.premium_access_id
      where l.owner_user_id=p_owner and p.status='active' and p.paid_access_until>now()
        and left(p.stripe_checkout_session_id,length(p_prefix))=p_prefix);
end $$;
revoke all on function public.contact_credit_overview(uuid,text) from public,anon,authenticated;
grant execute on function public.contact_credit_overview(uuid,text) to service_role;

-- Signed webhook handlers call this function. The row lock makes replay and
-- out-of-order terminal events deterministic. Reversals invalidate all spends
-- charged to this pack, while preserving spends funded by other paid packs.
create function public.settle_contact_credit_order(p_order uuid,p_owner uuid,p_session text,
  p_intent text,p_event text,p_amount integer,p_currency text,p_state text,p_event_created bigint default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.employer_contact_credit_orders%rowtype;
begin
  if p_state not in ('paid','failed','refunded','disputed','reinstated') or p_event is null or p_event=''
    or p_intent is null and p_state in ('paid','refunded','disputed','reinstated')
    or p_state in ('refunded','disputed','reinstated') and p_event_created is not null and p_event_created <= 0
    then raise exception 'INVALID_SETTLEMENT'; end if;
  select * into v from public.employer_contact_credit_orders where id=p_order and owner_user_id=p_owner
    and stripe_session_id=p_session for update;
  if not found or p_amount<>v.amount or p_currency<>v.currency then raise exception 'ORDER_MISMATCH'; end if;
  if v.stripe_payment_intent_id is not null and p_intent is not null and v.stripe_payment_intent_id<>p_intent then
    raise exception 'INTENT_MISMATCH'; end if;
  if p_state='paid' then
    if v.status='paid' then return 'duplicate'; end if;
    -- A signed paid event may arrive after an async failure notification.
    if v.status not in ('pending','failed') then return 'terminal'; end if;
    update public.employer_contact_credit_orders set status='paid',credits_remaining=pack_size,
      stripe_payment_intent_id=p_intent,stripe_paid_event_id=p_event,paid_at=now() where id=p_order;
  elsif p_state='failed' then
    if v.status<>'pending' then return 'duplicate'; end if;
    update public.employer_contact_credit_orders set status='failed' where id=p_order;
  elsif p_state='reinstated' then
    if v.status='refunded' then return 'terminal'; end if;
    if v.status<>'disputed' or p_event_created is not null and p_event_created<=v.stripe_last_reversal_created
      then return 'duplicate'; end if;
    update public.employer_contact_credit_orders set status='paid',
      credits_remaining=pack_size-(select count(*) from public.employer_contact_credit_spends where order_id=p_order),
      stripe_last_reversal_created=coalesce(p_event_created,stripe_last_reversal_created),
      stripe_reversal_event_id=p_event,reversed_at=null where id=p_order;
  else
    if p_event_created is not null and (p_event_created<v.stripe_last_reversal_created
      or p_event_created=v.stripe_last_reversal_created and p_state<>'refunded') then return 'duplicate'; end if;
    if v.status='refunded' then return 'duplicate'; end if;
    if v.status='disputed' and p_state='disputed' then return 'duplicate'; end if;
    update public.employer_contact_credit_orders set status=p_state,credits_remaining=0,
      stripe_payment_intent_id=coalesce(stripe_payment_intent_id,p_intent),
      stripe_reversal_event_id=p_event,stripe_last_reversal_created=coalesce(p_event_created,stripe_last_reversal_created),
      paid_at=coalesce(paid_at,now()),reversed_at=now() where id=p_order;
  end if;
  return 'updated';
end $$;
revoke all on function public.settle_contact_credit_order(uuid,uuid,text,text,text,integer,text,text,bigint) from public,anon,authenticated;
grant execute on function public.settle_contact_credit_order(uuid,uuid,text,text,text,integer,text,text,bigint) to service_role;
alter table public.employer_payment_reversals drop constraint employer_payment_reversals_product_check;
alter table public.employer_payment_reversals add constraint employer_payment_reversals_product_check
  check (product in ('direct','workspace','credit'));
alter table public.employer_contact_handoffs drop constraint employer_contact_handoffs_product_check;
alter table public.employer_contact_handoffs add constraint employer_contact_handoffs_product_check
  check (product in ('direct','workspace','credit','legacy'));
commit;
