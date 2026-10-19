-- Additive private activation campaign. No worker is linked, marked available,
-- opted in, or contacted by this migration.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create table public.worker_activation_queue (
  worker_id uuid primary key references public.workers(id) on delete restrict,
  invitation_permission_at timestamptz,
  invitation_evidence text,
  invitation_channel text check(invitation_channel in ('whatsapp','sms')),
  suppressed_at timestamptz,
  suppression_reason text,
  opted_out_at timestamptz,
  unreachable_at timestamptz,
  created_at timestamptz not null default now(),
  check ((invitation_permission_at is null) = (invitation_evidence is null)
    and (invitation_permission_at is null) = (invitation_channel is null)),
  check (invitation_evidence is null or invitation_evidence ~ '^[A-Za-z0-9:_-]{5,160}$'),
  check ((suppressed_at is null) = (suppression_reason is null)),
  check (suppression_reason is null or suppression_reason in ('worker_request','invalid_contact','provider_failure','dispute','operator_hold'))
);
insert into public.worker_activation_queue(worker_id) select id from public.workers;
create function public.worker_activation_enqueue() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.worker_activation_queue(worker_id) values(new.id) on conflict do nothing;
  return new;
end $$;
create trigger worker_activation_enqueue after insert on public.workers
  for each row execute function public.worker_activation_enqueue();

create table public.worker_notification_consent (
  worker_id uuid not null references public.workers(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  channel text not null check(channel in ('whatsapp','sms')),
  consent_version text not null check(consent_version='jobs-v1'),
  consented_at timestamptz not null,
  revoked_at timestamptz,
  primary key(worker_id,channel)
);
create table public.worker_activation_permission_events (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete restrict,
  channel text not null check(channel in ('whatsapp','sms')),
  evidence_reference text not null check(evidence_reference ~ '^[A-Za-z0-9:_-]{5,160}$'),
  recorded_at timestamptz not null default now()
);

create table public.worker_activation_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'review' check(status in ('review','cancelled','approved','closed')),
  channel text not null check(channel in ('whatsapp','sms')),
  max_recipients integer not null check(max_recipients between 1 and 20),
  cost_ceiling_cents integer not null check(cost_ceiling_cents between 0 and 1000000),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create table public.worker_activation_batch_recipients (
  batch_id uuid not null references public.worker_activation_batches(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  contact_fingerprint text not null check(contact_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'review' check(status in ('review','cancelled','claimed','sent','delivered','responded','failed','uncertain','opted_out')),
  provider_reference text,
  claimed_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  responded_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  primary key(batch_id,worker_id),
  unique(worker_id),
  unique(contact_fingerprint),
  check (provider_reference is null or char_length(provider_reference) between 5 and 200),
  check (failure_code is null or failure_code ~ '^[A-Za-z0-9_-]{2,60}$')
);

alter table public.worker_activation_queue enable row level security;
alter table public.worker_notification_consent enable row level security;
alter table public.worker_activation_permission_events enable row level security;
alter table public.worker_activation_batches enable row level security;
alter table public.worker_activation_batch_recipients enable row level security;
revoke all on public.worker_activation_queue,public.worker_notification_consent,
  public.worker_activation_permission_events,
  public.worker_activation_batches,public.worker_activation_batch_recipients from public,anon,authenticated;
grant all on public.worker_activation_queue,public.worker_notification_consent,
  public.worker_activation_permission_events,
  public.worker_activation_batches,public.worker_activation_batch_recipients to service_role;
revoke all on function public.worker_activation_enqueue() from public,anon,authenticated;

-- A freshly verified Auth account can confirm an already linked, approved
-- profile without an admin-issued bearer link. This never grants ownership.
create function public.worker_activation_confirm(p_actor uuid,p_worker uuid,p_available boolean)
returns table(available boolean, confirmed_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
begin
  if p_actor is null or p_worker is null or p_available is null then return; end if;
  perform 1 from public.workers w where w.id=p_worker and w.owner_user_id=p_actor
    and w.is_verified=true for update;
  if not found then return; end if;
  insert into public.worker_availability(worker_id,token_hash,access_expires_at,available,confirmed_at)
    values(p_worker,md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),
      now()+interval '180 days',p_available,now())
    on conflict(worker_id) do update set token_hash=excluded.token_hash,
      available=excluded.available,confirmed_at=excluded.confirmed_at,
      access_expires_at=greatest(worker_availability.access_expires_at,excluded.access_expires_at);
  update public.workers set available_now=p_available where id=p_worker and owner_user_id=p_actor;
  return query select a.available,a.confirmed_at from public.worker_availability a where a.worker_id=p_worker;
end $$;

create function public.worker_activation_notification_consent(
  p_actor uuid,p_worker uuid,p_channel text,p_agree boolean)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_actor is null or p_worker is null or p_channel not in ('whatsapp','sms') or p_agree is null then
    raise exception 'INVALID_CONSENT';
  end if;
  perform 1 from public.workers w where w.id=p_worker and w.owner_user_id=p_actor
    and w.is_verified=true for update;
  if not found then raise exception 'OWNERSHIP_REQUIRED'; end if;
  if p_agree then
    insert into public.worker_notification_consent(worker_id,owner_user_id,channel,consent_version,consented_at,revoked_at)
      values(p_worker,p_actor,p_channel,'jobs-v1',now(),null)
      on conflict(worker_id,channel) do update set owner_user_id=p_actor,consented_at=now(),revoked_at=null;
  else
    update public.worker_notification_consent set revoked_at=now()
      where worker_id=p_worker and owner_user_id=p_actor and channel=p_channel and revoked_at is null;
  end if;
end $$;
revoke all on function public.worker_activation_confirm(uuid,uuid,boolean),
  public.worker_activation_notification_consent(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.worker_activation_confirm(uuid,uuid,boolean),
  public.worker_activation_notification_consent(uuid,uuid,text,boolean) to service_role;

create function public.worker_activation_record_permission(
  p_worker uuid,p_channel text,p_evidence text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_worker is null or p_channel is null or p_channel not in ('whatsapp','sms')
    or p_evidence is null or p_evidence !~ '^[A-Za-z0-9:_-]{5,160}$' then raise exception 'INVALID_PERMISSION'; end if;
  update public.worker_activation_queue set invitation_permission_at=now(),
    invitation_channel=p_channel,invitation_evidence=p_evidence
    where worker_id=p_worker and opted_out_at is null and suppressed_at is null;
  if not found then raise exception 'PERMISSION_BLOCKED'; end if;
  insert into public.worker_activation_permission_events(worker_id,channel,evidence_reference)
    values(p_worker,p_channel,p_evidence);
end $$;
revoke all on function public.worker_activation_record_permission(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.worker_activation_record_permission(uuid,text,text) to service_role;

-- Draft preparation is atomic and never sends. A shared number, missing
-- channel-specific permission, suppression, or prior draft blocks selection.
create function public.worker_activation_phone_key(p_phone text) returns text
language sql immutable security invoker set search_path = '' as $$
  select case when length(digits)=10 then '1'||digits
    when length(digits) between 11 and 15 and left(digits,1)<>'0' then digits
    else null end
  from (select regexp_replace(coalesce(p_phone,''),'[^0-9]','','g') as digits) x;
$$;
create function public.worker_activation_prepare_batch(
  p_workers uuid[],p_channel text,p_cost_ceiling integer)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare prepared uuid; selected_count integer;
begin
  if p_channel not in ('whatsapp','sms') or p_cost_ceiling is null or p_cost_ceiling<0
    or p_cost_ceiling>1000000 or cardinality(p_workers) not between 1 and 20
    or (select count(distinct id) from unnest(p_workers) id)<>cardinality(p_workers) then
    raise exception 'INVALID_BATCH';
  end if;
  -- Unique worker and contact indexes also fail closed under concurrent drafts.
  select count(*) into selected_count from public.workers w
    join public.worker_activation_queue q on q.worker_id=w.id
    where w.id=any(p_workers) and w.is_verified=true
      and q.invitation_permission_at is not null and q.invitation_channel=p_channel
      and q.suppressed_at is null and q.opted_out_at is null and q.unreachable_at is null
      and public.worker_activation_phone_key(w.whatsapp_number) is not null
      and not exists(select 1 from public.workers other
        where other.id<>w.id and public.worker_activation_phone_key(other.whatsapp_number)
          =public.worker_activation_phone_key(w.whatsapp_number))
      and not exists(select 1 from public.worker_activation_batch_recipients r where r.worker_id=w.id);
  if selected_count<>cardinality(p_workers) then raise exception 'BATCH_NOT_ELIGIBLE'; end if;
  insert into public.worker_activation_batches(channel,max_recipients,cost_ceiling_cents)
    values(p_channel,cardinality(p_workers),p_cost_ceiling) returning id into prepared;
  insert into public.worker_activation_batch_recipients(batch_id,worker_id,contact_fingerprint)
    select prepared,w.id,md5(public.worker_activation_phone_key(w.whatsapp_number))||
      md5('listord:'||public.worker_activation_phone_key(w.whatsapp_number))
    from public.workers w where w.id=any(p_workers);
  return prepared;
end $$;
revoke all on function public.worker_activation_phone_key(text),
  public.worker_activation_prepare_batch(uuid[],text,integer) from public,anon,authenticated;
grant execute on function public.worker_activation_phone_key(text),
  public.worker_activation_prepare_batch(uuid[],text,integer) to service_role;

create function public.worker_activation_suppress(p_worker uuid,p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_worker is null or p_reason not in
    ('worker_request','invalid_contact','provider_failure','dispute','operator_hold') then
    raise exception 'INVALID_SUPPRESSION';
  end if;
  update public.worker_activation_queue set suppressed_at=now(),suppression_reason=p_reason,
    opted_out_at=case when p_reason='worker_request' then now() else opted_out_at end,
    unreachable_at=case when p_reason in ('invalid_contact','provider_failure') then now() else unreachable_at end
    where worker_id=p_worker;
  if not found then raise exception 'WORKER_NOT_FOUND'; end if;
  update public.worker_activation_batch_recipients
    set status=case when p_reason='worker_request' then 'opted_out' else 'cancelled' end
    where worker_id=p_worker and status='review';
end $$;
create function public.worker_activation_self_opt_out(p_actor uuid,p_worker uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.workers w where w.id=p_worker and w.owner_user_id=p_actor for update;
  if not found then raise exception 'OWNERSHIP_REQUIRED'; end if;
  perform public.worker_activation_suppress(p_worker,'worker_request');
end $$;
revoke all on function public.worker_activation_suppress(uuid,text),
  public.worker_activation_self_opt_out(uuid,uuid) from public,anon,authenticated;
grant execute on function public.worker_activation_suppress(uuid,text),
  public.worker_activation_self_opt_out(uuid,uuid) to service_role;

-- Legacy private availability links must also stop at the ownership boundary.
-- Existing links remain usable only for approved profiles with a linked owner.
do $$
begin
  if to_regprocedure('public.issue_worker_availability(uuid,text)') is null
    or to_regprocedure('public.renew_worker_availability(text,boolean)') is null
    or position('where id=p_worker_id and is_verified=true for update'
      in pg_get_functiondef('public.issue_worker_availability(uuid,text)'::regprocedure))=0
    or position('where w.id=v_worker and w.is_verified=true for update'
      in pg_get_functiondef('public.renew_worker_availability(text,boolean)'::regprocedure))=0 then
    raise exception 'Unexpected legacy availability functions: reconcile before replacing';
  end if;
end $$;
create or replace function public.issue_worker_availability(p_worker_id uuid, p_token_hash text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.workers where id=p_worker_id and is_verified=true
    and owner_user_id is not null for update;
  if not found then raise exception 'worker unavailable'; end if;
  insert into public.worker_availability(worker_id, token_hash, access_expires_at)
    values(p_worker_id, p_token_hash, now() + interval '180 days')
    on conflict(worker_id) do update set token_hash=excluded.token_hash,
      access_expires_at=excluded.access_expires_at, available=false, confirmed_at=null,
      issued_at=now(), ownership_verified_at=now();
end;
$$;
create or replace function public.renew_worker_availability(p_token_hash text, p_available boolean)
returns table(available boolean, confirmed_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare v_worker uuid;
begin
  if p_available is null then raise exception 'invalid availability'; end if;
  select a.worker_id into v_worker from public.worker_availability a
    where a.token_hash=p_token_hash and a.access_expires_at > now();
  if v_worker is null then return; end if;
  perform 1 from public.workers w where w.id=v_worker and w.is_verified=true
    and w.owner_user_id is not null for update;
  if not found then return; end if;
  update public.worker_availability a set available=p_available, confirmed_at=now()
    where a.worker_id=v_worker and a.token_hash=p_token_hash and a.access_expires_at > now();
  if not found then return; end if;
  update public.workers set available_now=p_available where id=v_worker and owner_user_id is not null;
  return query select a.available, a.confirmed_at from public.worker_availability a where a.worker_id=v_worker;
end;
$$;
revoke all on function public.issue_worker_availability(uuid,text),
  public.renew_worker_availability(text,boolean) from public,anon,authenticated;
grant execute on function public.issue_worker_availability(uuid,text),
  public.renew_worker_availability(text,boolean) to service_role;

-- The existing Express SQL checks must use the same seven-day expiry as the
-- application. Refuse unexpected function definitions for manual review.
do $$
declare item record; definition text; needle text := 'interval ''30 days'''; hits integer;
begin
  for item in select * from (values
    ('public.marketplace_express_targets(uuid,uuid,uuid[])',1),
    ('public.marketplace_express_reserve(uuid,uuid,text,uuid[])',1),
    ('public.marketplace_express_chargeable(uuid)',1),
    ('public.marketplace_express_claim(uuid)',1)
  ) as targets(signature,expected_hits) loop
    if to_regprocedure(item.signature) is null then raise exception 'Express function missing: %',item.signature; end if;
    definition := pg_get_functiondef(to_regprocedure(item.signature));
    hits := (length(definition)-length(replace(definition,needle,'')))/length(needle);
    if hits<>item.expected_hits or position('SECURITY DEFINER' in upper(definition))=0 then
      raise exception 'Unexpected Express availability guard: %',item.signature;
    end if;
    execute replace(definition,needle,'interval ''7 days''');
  end loop;
end $$;
commit;
