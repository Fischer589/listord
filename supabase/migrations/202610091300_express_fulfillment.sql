-- UNAPPLIED. New one-time Express ledger; never repurposes legacy financial rows.
begin;
create table public.marketplace_express_orders (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.marketplace_opportunities(id),
  owner_user_id uuid not null references auth.users(id),
  channel text not null check(channel in ('stripe','transfer')),
  reference uuid not null unique default gen_random_uuid(),
  amount integer not null default 29900 check(amount=29900),
  currency text not null default 'dop' check(currency='dop'),
  terms_version text not null check(terms_version='express-v1-draft'),
  status text not null default 'payment_pending' check(status in ('payment_pending','paid','fulfilled','remedy_due','refunded')),
  checkout_session_id text unique, payment_reference text unique, paid_at timestamptz, deadline timestamptz,
  refund_reference text unique, created_at timestamptz not null default now(),
  check(status='payment_pending' or (payment_reference is not null and paid_at is not null and deadline is not null)),
  check(status<>'refunded' or refund_reference is not null)
);
create table public.marketplace_express_invitations (
  order_id uuid not null references public.marketplace_express_orders(id),
  worker_id uuid not null references public.workers(id),
  owner_user_id uuid not null references auth.users(id),
  status text not null default 'pending' check(status in ('pending','sending','sent','cancelled')),
  provider_reference text unique,
  sent_at timestamptz,
  primary key(order_id,worker_id),
  check(status<>'sent' or (provider_reference is not null and sent_at is not null))
);
create table public.marketplace_payment_events (
  event_key text primary key check(char_length(event_key) between 5 and 200),
  order_id uuid not null references public.marketplace_express_orders(id),
  kind text not null check(kind in ('paid','refund')),
  actor_label text not null check(char_length(actor_label) between 3 and 100),
  created_at timestamptz not null default now()
);

-- Same deliverability projection for the pre-payment quote and reservation.
create function public.marketplace_express_targets(p_actor uuid,p_id uuid,p_workers uuid[])
returns table(worker_id uuid) language sql security definer set search_path = '' as $$
  select w.id from public.workers w
  join public.marketplace_outreach_consent c on c.worker_id=w.id and c.owner_user_id=w.owner_user_id and c.revoked_at is null
  join public.worker_availability a on a.worker_id=w.id and a.available and a.confirmed_at>now()-interval '30 days' and a.confirmed_at<=now() and a.access_expires_at>now()
  where w.id=any(p_workers) and w.is_verified and w.available_now and w.owner_user_id<>p_actor
    and w.whatsapp_number ~ '^\+?[1-9][0-9]{9,14}$'
    and exists(select 1 from public.marketplace_opportunities o join public.marketplace_opportunity_owners x on x.opportunity_id=o.id where o.id=p_id and x.owner_user_id=p_actor and o.status='open' and o.moderation_status='approved' and o.expires_at>now()+interval '26 hours')
    and not exists(select 1 from public.marketplace_interests i where i.opportunity_id=p_id and i.worker_id=w.id and i.decision in ('interested','declined'))
  order by w.id limit 20;
$$;
revoke all on function public.marketplace_express_targets(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.marketplace_express_targets(uuid,uuid,uuid[]) to service_role;

create function public.marketplace_express_reserve(p_actor uuid,p_id uuid,p_channel text,p_workers uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare o public.marketplace_opportunities; existing public.marketplace_express_orders; order_id uuid;
begin
  select * into o from public.marketplace_opportunities where id=p_id for update;
  if not found or not exists(select 1 from public.marketplace_opportunity_owners where opportunity_id=p_id and owner_user_id=p_actor) then raise exception 'OWNERSHIP_REQUIRED'; end if;
  select * into existing from public.marketplace_express_orders where opportunity_id=p_id;
  if found then
    if existing.channel<>p_channel then raise exception 'INVALID_CHANNEL_SWITCH'; end if;
    return existing.id;
  end if;
  if o.status<>'open' or o.moderation_status<>'approved' or o.expires_at<now()+interval '26 hours' then raise exception 'NOT_OPEN'; end if;
  perform public.marketplace_throttle(p_actor,'express',5);
  if p_channel is null or p_channel not in ('stripe','transfer') or coalesce(cardinality(p_workers),0) not between 1 and 20 then raise exception 'INVALID_TARGETS'; end if;
  insert into public.marketplace_express_orders(opportunity_id,owner_user_id,channel,terms_version)
    values(p_id,p_actor,p_channel,'express-v1-draft') returning id into order_id;
  insert into public.marketplace_express_invitations(order_id,worker_id,owner_user_id)
    select order_id,w.id,w.owner_user_id from public.workers w
    join public.marketplace_outreach_consent c on c.worker_id=w.id and c.owner_user_id=w.owner_user_id and c.revoked_at is null
    join public.worker_availability a on a.worker_id=w.id and a.available and a.confirmed_at>now()-interval '30 days'
      and a.confirmed_at<=now() and a.access_expires_at>now()
    where w.id=any(p_workers) and w.is_verified and w.available_now and w.owner_user_id<>p_actor
      and w.whatsapp_number ~ '^\+?[1-9][0-9]{9,14}$'
      and not exists(select 1 from public.marketplace_interests i where i.opportunity_id=p_id and i.worker_id=w.id and i.decision in ('interested','declined'));
  if not found then raise exception 'NO_DELIVERABLE_OUTREACH'; end if;
  return order_id;
end $$;

create function public.marketplace_express_chargeable(p_order uuid) returns boolean
language sql security definer set search_path = '' as $$
  select exists(select 1 from public.marketplace_express_orders o
    join public.marketplace_opportunities p on p.id=o.opportunity_id and p.status='open' and p.moderation_status='approved' and p.expires_at>now()+interval '24 hours'
    join public.marketplace_express_invitations n on n.order_id=o.id and n.status='pending'
    join public.workers w on w.id=n.worker_id and w.owner_user_id=n.owner_user_id and w.is_verified and w.available_now
    join public.marketplace_outreach_consent c on c.worker_id=n.worker_id and c.owner_user_id=n.owner_user_id and c.revoked_at is null
    join public.worker_availability a on a.worker_id=n.worker_id and a.available and a.confirmed_at>now()-interval '30 days' and a.confirmed_at<=now() and a.access_expires_at>now()
    where w.whatsapp_number ~ '^\+?[1-9][0-9]{9,14}$'
      and not exists(select 1 from public.marketplace_interests i where i.opportunity_id=p.id and i.worker_id=w.id and i.decision in ('interested','declined'))
      and o.id=p_order and o.status='payment_pending' and o.created_at>now()-interval '30 minutes');
$$;

create function public.marketplace_express_paid(p_order uuid,p_channel text,p_reference text,p_event text,p_amount integer,p_currency text,p_actor_label text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.marketplace_express_orders; e public.marketplace_payment_events;
begin
  select * into o from public.marketplace_express_orders where id=p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_channel is distinct from o.channel or p_amount is distinct from o.amount or p_currency is distinct from o.currency
    or p_reference is null or char_length(p_reference) not between 5 and 200 then raise exception 'INVALID_PAYMENT'; end if;
  select * into e from public.marketplace_payment_events where event_key=p_event;
  if found then
    if e.order_id<>p_order or e.kind<>'paid' or o.payment_reference is distinct from p_reference then raise exception 'EVENT_CONFLICT'; end if;
    return;
  end if;
  if o.status<>'payment_pending' then
    if o.payment_reference is distinct from p_reference then raise exception 'DUPLICATE_PAYMENT'; end if;
  else
    update public.marketplace_express_orders set status='paid',payment_reference=p_reference,paid_at=now(),deadline=now()+interval '24 hours' where id=p_order;
    insert into public.marketplace_events(opportunity_id,kind) values(o.opportunity_id,'express_paid');
  end if;
  insert into public.marketplace_payment_events(event_key,order_id,kind,actor_label) values(p_event,p_order,'paid',p_actor_label);
end $$;

-- Called before each dispatch attempt and when an owner loads order status.
-- Closing, expiry or no response invokes the remedy instead of claiming success.
create function public.marketplace_express_reconcile(p_order uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare o public.marketplace_express_orders; live boolean;
begin
  select * into o from public.marketplace_express_orders where id=p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status<>'paid' then return o.status; end if;
  select status='open' and moderation_status='approved' and expires_at>now() into live from public.marketplace_opportunities where id=o.opportunity_id;
  if exists(select 1 from public.marketplace_interests i
    join public.marketplace_express_invitations n on n.worker_id=i.worker_id and n.order_id=p_order
    join public.workers w on w.id=i.worker_id and w.owner_user_id=n.owner_user_id and w.is_verified
    where i.opportunity_id=o.opportunity_id and i.decision='interested' and i.decision_user_id=n.owner_user_id and i.updated_at>=o.paid_at and i.updated_at<=o.deadline and n.status='sent') then
    update public.marketplace_express_orders set status='fulfilled' where id=p_order;
  elsif not live or o.deadline<=now() or not exists(select 1 from public.marketplace_express_invitations n
    join public.marketplace_outreach_consent c on c.worker_id=n.worker_id and c.owner_user_id=n.owner_user_id and c.revoked_at is null
    join public.workers w on w.id=n.worker_id and w.owner_user_id=n.owner_user_id and w.is_verified
    where n.order_id=p_order and n.status in ('pending','sending','sent')) then
    update public.marketplace_express_orders set status='remedy_due' where id=p_order;
    update public.marketplace_express_invitations set status='cancelled' where order_id=p_order and status='pending';
    insert into public.marketplace_events(opportunity_id,kind) values(o.opportunity_id,'express_remedy_due');
  end if;
  return (select status from public.marketplace_express_orders where id=p_order);
end $$;

create function public.marketplace_express_sent(p_order uuid,p_worker uuid,p_receipt text) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.marketplace_express_invitations;
begin
  perform 1 from public.marketplace_express_orders where id=p_order and paid_at is not null for update;
  if not found then raise exception 'INVALID_DELIVERY'; end if;
  select * into n from public.marketplace_express_invitations where order_id=p_order and worker_id=p_worker for update;
  if not found or p_receipt is null or char_length(p_receipt) not between 5 and 200 then raise exception 'INVALID_DELIVERY'; end if;
  if n.status='sent' then
    if n.provider_reference<>p_receipt then raise exception 'DELIVERY_CONFLICT'; end if;
    return;
  end if;
  if n.status<>'sending' then raise exception 'INVALID_DELIVERY'; end if;
  -- Receipt records actual delivery even if consent was revoked during transport;
  -- the dispatcher must check consent immediately before sending. No re-send.
  update public.marketplace_express_invitations set status='sent',provider_reference=p_receipt,sent_at=now() where order_id=p_order and worker_id=p_worker;
  perform public.marketplace_express_reconcile(p_order);
end $$;

-- Durable one-shot dispatch claim. A timeout/crash is deliberately NOT retried:
-- the provider may have accepted it. Reconcile receipt or refund; never guess.
create function public.marketplace_express_claim(p_order uuid)
returns table(worker_id uuid,phone text,opportunity_id uuid)
language plpgsql security definer set search_path = '' as $$
declare selected uuid;
begin
  if public.marketplace_express_reconcile(p_order)<>'paid' then return; end if;
  select n.worker_id into selected from public.marketplace_express_invitations n
    join public.workers w on w.id=n.worker_id and w.owner_user_id=n.owner_user_id and w.is_verified and w.available_now
    join public.marketplace_outreach_consent c on c.worker_id=n.worker_id and c.owner_user_id=n.owner_user_id and c.revoked_at is null
    join public.worker_availability a on a.worker_id=n.worker_id and a.available and a.confirmed_at>now()-interval '30 days' and a.confirmed_at<=now() and a.access_expires_at>now()
    where n.order_id=p_order and n.status='pending'
      and w.whatsapp_number ~ '^\+?[1-9][0-9]{9,14}$'
      and not exists(select 1 from public.marketplace_interests i join public.marketplace_express_orders o on o.opportunity_id=i.opportunity_id where o.id=p_order and i.worker_id=w.id and i.decision in ('interested','declined'))
      order by n.worker_id limit 1 for update of n skip locked;
  if selected is null then return; end if;
  update public.marketplace_express_invitations n set status='sending' where n.order_id=p_order and n.worker_id=selected;
  return query select w.id,w.whatsapp_number,o.opportunity_id from public.workers w cross join public.marketplace_express_orders o where w.id=selected and o.id=p_order;
end $$;

create function public.marketplace_express_refund(p_order uuid,p_reference text,p_event text,p_actor_label text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.marketplace_express_orders;
begin
  select * into o from public.marketplace_express_orders where id=p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status='refunded' and o.refund_reference=p_reference then return; end if;
  if o.status<>'remedy_due' or p_reference is null or char_length(p_reference) not between 5 and 200 then raise exception 'INVALID_REFUND'; end if;
  insert into public.marketplace_payment_events(event_key,order_id,kind,actor_label) values(p_event,p_order,'refund',p_actor_label);
  update public.marketplace_express_orders set status='refunded',refund_reference=p_reference where id=p_order;
  insert into public.marketplace_events(opportunity_id,kind) values(o.opportunity_id,'express_refunded');
end $$;

-- Genuine response changes update the employer's ledger without a scheduler.
create function public.marketplace_express_response_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  select id into target from public.marketplace_express_orders where opportunity_id=new.opportunity_id;
  if target is not null then perform public.marketplace_express_reconcile(target); end if;
  return new;
end $$;
revoke all on function public.marketplace_express_response_changed() from public,anon,authenticated;
create trigger marketplace_express_response_changed after insert or update on public.marketplace_interests
  for each row execute function public.marketplace_express_response_changed();

alter table public.marketplace_express_orders enable row level security;
alter table public.marketplace_express_invitations enable row level security;
alter table public.marketplace_payment_events enable row level security;
revoke all on public.marketplace_express_orders,public.marketplace_express_invitations,public.marketplace_payment_events from public,anon,authenticated;
grant all on public.marketplace_express_orders,public.marketplace_express_invitations,public.marketplace_payment_events to service_role;
revoke all on function public.marketplace_express_reserve(uuid,uuid,text,uuid[]),public.marketplace_express_paid(uuid,text,text,text,integer,text,text),
  public.marketplace_express_chargeable(uuid),public.marketplace_express_reconcile(uuid),public.marketplace_express_claim(uuid),public.marketplace_express_sent(uuid,uuid,text),public.marketplace_express_refund(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.marketplace_express_reserve(uuid,uuid,text,uuid[]),public.marketplace_express_paid(uuid,text,text,text,integer,text,text),
  public.marketplace_express_chargeable(uuid),public.marketplace_express_reconcile(uuid),public.marketplace_express_claim(uuid),public.marketplace_express_sent(uuid,uuid,text),public.marketplace_express_refund(uuid,text,text,text) to service_role;
commit;
