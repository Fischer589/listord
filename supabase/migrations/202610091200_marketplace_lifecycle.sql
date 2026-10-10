-- UNAPPLIED candidate. Requires foundation + availability + privacy candidates.
-- No legacy ownership is inferred, no worker activated, no financial row rewritten.
begin;
alter table public.marketplace_interests add column decision_user_id uuid references auth.users(id);
create table public.marketplace_rate_limits (
  actor uuid not null references auth.users(id), action text not null,
  bucket timestamptz not null, attempts integer not null check (attempts > 0),
  primary key(actor, action, bucket)
);
create table public.marketplace_outreach_consent (
  worker_id uuid primary key references public.workers(id),
  owner_user_id uuid not null references auth.users(id),
  consent_version text not null check (consent_version = 'express-v1'),
  consented_at timestamptz not null default now(), revoked_at timestamptz
);
create table public.marketplace_events (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null references public.marketplace_opportunities(id),
  actor uuid references auth.users(id), kind text not null,
  created_at timestamptz not null default now()
);

-- The service role is the only RPC caller. actor is supplied by the server after
-- auth.getUser(token), never from JSON, phone, browser IDs or legacy edit tokens.
create function public.marketplace_throttle(p_actor uuid, p_action text, p_limit integer)
returns void language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then
    raise exception 'AUTH_REQUIRED';
  end if;
  insert into public.marketplace_rate_limits values(p_actor,p_action,date_trunc('hour',now()),1)
  on conflict(actor,action,bucket) do update set attempts=marketplace_rate_limits.attempts+1
  returning attempts into n;
  if n>p_limit then raise exception 'RATE_LIMIT'; end if;
end $$;

create function public.marketplace_create(p_actor uuid, p_key uuid, p_draft jsonb,
  p_name text, p_phone text, p_consent boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare found_id uuid; created_id uuid;
begin
  -- Serialize retries before checking the owner/key unique index.
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
  select opportunity_id into found_id from public.marketplace_opportunity_owners
    where owner_user_id=p_actor and idempotency_key=p_key;
  if found_id is not null then return found_id; end if;
  perform public.marketplace_throttle(p_actor,'create',5);
  if p_consent is distinct from true or p_key is null then raise exception 'CONSENT_REQUIRED'; end if;
  insert into public.marketplace_opportunities(category,city,scope,specification,timing_note,duration_note,
    compensation_kind,compensation_min,compensation_unit,expires_at)
  values(p_draft->>'category',p_draft->>'city',p_draft->>'summary',p_draft->'specification',
    p_draft->>'timing',p_draft->>'duration',p_draft->>'compensation',
    (p_draft->>'amount')::numeric,p_draft->>'unit',now()+interval '14 days') returning id into created_id;
  insert into public.marketplace_opportunity_owners(opportunity_id,owner_user_id,idempotency_key,
    contact_name,whatsapp_number,publication_consent_at)
  values(created_id,p_actor,p_key,p_name,p_phone,now());
  insert into public.marketplace_events(opportunity_id,actor,kind) values(created_id,p_actor,'submitted');
  return created_id;
end $$;

create function public.marketplace_transition(p_actor uuid,p_id uuid,p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare current_status text;
begin
  select o.status into current_status from public.marketplace_opportunities o
    join public.marketplace_opportunity_owners x on x.opportunity_id=o.id
    where o.id=p_id and x.owner_user_id=p_actor for update of o;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_status not in ('closed','filled') or current_status not in ('draft','open',p_status)
    or (p_status='filled' and current_status='draft') then raise exception 'INVALID_TRANSITION'; end if;
  if current_status=p_status then return; end if;
  perform public.marketplace_throttle(p_actor,'lifecycle',30);
  update public.marketplace_opportunities set status=p_status where id=p_id;
  insert into public.marketplace_events(opportunity_id,actor,kind) values(p_id,p_actor,p_status);
end $$;

create function public.marketplace_moderate(p_id uuid,p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.marketplace_opportunities;
begin
  select * into o from public.marketplace_opportunities where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_approve is null or o.status not in ('draft','open') or o.expires_at<=now() then raise exception 'INVALID_TRANSITION'; end if;
  update public.marketplace_opportunities set
    moderation_status=case when p_approve then 'approved' else 'rejected' end,
    status=case when p_approve then 'open' else 'closed' end,
    published_at=case when p_approve then coalesce(published_at,now()) else published_at end where id=p_id;
  insert into public.marketplace_events(opportunity_id,kind) values(p_id,case when p_approve then 'moderated_approved' else 'moderated_rejected' end);
end $$;

create function public.marketplace_decide(p_actor uuid,p_id uuid,p_worker uuid,p_decision text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.marketplace_opportunities;
begin
  select * into o from public.marketplace_opportunities where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not exists(select 1 from public.workers where id=p_worker and owner_user_id=p_actor and is_verified) then
    raise exception 'OWNERSHIP_REQUIRED';
  end if;
  if p_decision is null or p_decision not in ('interested','declined','withdrawn') then raise exception 'INVALID_DECISION'; end if;
  if p_decision<>'withdrawn' and (o.status<>'open' or o.moderation_status<>'approved' or o.expires_at<=now()) then
    raise exception 'NOT_OPEN';
  end if;
  if exists(select 1 from public.marketplace_opportunity_owners where opportunity_id=p_id and owner_user_id=p_actor) then
    raise exception 'SELF_RESPONSE';
  end if;
  if p_decision='withdrawn' and not exists(select 1 from public.marketplace_interests where opportunity_id=p_id and worker_id=p_worker) then
    raise exception 'NOT_FOUND';
  end if;
  if exists(select 1 from public.marketplace_interests where opportunity_id=p_id and worker_id=p_worker and decision=p_decision and decision_user_id=p_actor) then return; end if;
  perform public.marketplace_throttle(p_actor,'decision',60);
  insert into public.marketplace_interests(opportunity_id,worker_id,decision,decision_user_id) values(p_id,p_worker,p_decision,p_actor)
  on conflict(opportunity_id,worker_id) do update set decision=excluded.decision,decision_user_id=p_actor;
  insert into public.marketplace_events(opportunity_id,actor,kind) values(p_id,p_actor,p_decision);
end $$;

create function public.marketplace_contacts(p_actor uuid,p_id uuid) returns table(name text,phone text)
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.marketplace_opportunities where id=p_id and status='open' and moderation_status='approved' and expires_at>now() for share;
  if not found then raise exception 'NOT_OPEN'; end if;
  perform public.marketplace_throttle(p_actor,'contact',60);
  if exists(select 1 from public.marketplace_opportunity_owners where opportunity_id=p_id and owner_user_id=p_actor) then
    return query select w.full_name,w.whatsapp_number from public.marketplace_interests i join public.workers w on w.id=i.worker_id
      where i.opportunity_id=p_id and i.decision='interested' and w.is_verified and w.owner_user_id=i.decision_user_id order by i.updated_at limit 50;
  elsif exists(select 1 from public.marketplace_interests i join public.workers w on w.id=i.worker_id
    where i.opportunity_id=p_id and i.decision='interested' and w.is_verified and w.owner_user_id=p_actor and i.decision_user_id=p_actor) then
    return query select o.contact_name,o.whatsapp_number from public.marketplace_opportunity_owners o where o.opportunity_id=p_id;
  else raise exception 'OWNERSHIP_REQUIRED'; end if;
end $$;

create function public.marketplace_consent(p_actor uuid,p_worker uuid,p_agree boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_agree is null or not exists(select 1 from public.workers where id=p_worker and owner_user_id=p_actor and is_verified) then
    raise exception 'OWNERSHIP_REQUIRED';
  end if;
  perform public.marketplace_throttle(p_actor,'consent',20);
  insert into public.marketplace_outreach_consent(worker_id,owner_user_id,consent_version,revoked_at)
  values(p_worker,p_actor,'express-v1',case when p_agree then null else now() end)
  on conflict(worker_id) do update set owner_user_id=p_actor,consented_at=now(),revoked_at=excluded.revoked_at;
end $$;

create function public.marketplace_report(p_actor uuid,p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.marketplace_throttle(p_actor,'report',10);
  if not exists(select 1 from public.marketplace_opportunities where id=p_id and status='open' and expires_at>now()) then raise exception 'NOT_FOUND'; end if;
  insert into public.marketplace_reports(opportunity_id,reporter_user_id,reason) values(p_id,p_actor,p_reason);
end $$;

-- Report resolution and public removal are one transaction. No report contains
-- client-supplied contact details; only the authenticated admin may resolve it.
create function public.marketplace_resolve_report(p_report uuid,p_remove boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  select opportunity_id into target from public.marketplace_reports where id=p_report for update;
  if not found or p_remove is null then raise exception 'NOT_FOUND'; end if;
  if p_remove then
    update public.marketplace_opportunities set status='closed',moderation_status='rejected' where id=target;
    insert into public.marketplace_events(opportunity_id,kind) values(target,'report_removed');
  end if;
  update public.marketplace_reports set status='resolved' where id=p_report;
end $$;
revoke all on function public.marketplace_resolve_report(uuid,boolean) from public,anon,authenticated;
grant execute on function public.marketplace_resolve_report(uuid,boolean) to service_role;

-- Reviewed ownership recovery only. This never approves/activates a worker,
-- overwrites an existing owner or trusts the previously exposed edit token.
create table public.marketplace_ownership_audit (
  id bigint generated always as identity primary key,
  worker_id uuid not null references public.workers(id),
  owner_user_id uuid not null references auth.users(id),
  evidence_reference text not null check(char_length(evidence_reference) between 5 and 160),
  operator_label text not null check(char_length(operator_label) between 3 and 60),
  created_at timestamptz not null default now()
);
alter table public.marketplace_ownership_audit enable row level security;
revoke all on public.marketplace_ownership_audit from public,anon,authenticated;
grant all on public.marketplace_ownership_audit to service_role;
grant usage,select on sequence public.marketplace_ownership_audit_id_seq to service_role;
create function public.marketplace_link_owner(p_worker uuid,p_owner uuid,p_evidence text,p_operator text) returns void
language plpgsql security definer set search_path = '' as $$
declare existing uuid;
begin
  select owner_user_id into existing from public.workers where id=p_worker for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if existing is not null and existing<>p_owner then raise exception 'OWNERSHIP_REQUIRED'; end if;
  if existing=p_owner then return; end if;
  insert into public.marketplace_ownership_audit(worker_id,owner_user_id,evidence_reference,operator_label)
    values(p_worker,p_owner,p_evidence,p_operator);
  update public.workers set owner_user_id=p_owner where id=p_worker;
end $$;
revoke all on function public.marketplace_link_owner(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.marketplace_link_owner(uuid,uuid,text,text) to service_role;

-- Reads are explicitly projected by the application; private rows never receive
-- direct client grants. No email/phone or legacy ownership is copied to public data.
alter table public.marketplace_rate_limits enable row level security;
alter table public.marketplace_outreach_consent enable row level security;
alter table public.marketplace_events enable row level security;
revoke all on public.marketplace_rate_limits,public.marketplace_outreach_consent,public.marketplace_events from public,anon,authenticated;
grant all on public.marketplace_rate_limits,public.marketplace_outreach_consent,public.marketplace_events to service_role;
grant usage,select on sequence public.marketplace_events_id_seq to service_role;
revoke all on function public.marketplace_throttle(uuid,text,integer),public.marketplace_create(uuid,uuid,jsonb,text,text,boolean),
  public.marketplace_transition(uuid,uuid,text),public.marketplace_moderate(uuid,boolean),
  public.marketplace_decide(uuid,uuid,uuid,text),public.marketplace_consent(uuid,uuid,boolean),public.marketplace_report(uuid,uuid,text),public.marketplace_contacts(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.marketplace_create(uuid,uuid,jsonb,text,text,boolean),public.marketplace_transition(uuid,uuid,text),
  public.marketplace_moderate(uuid,boolean),public.marketplace_decide(uuid,uuid,uuid,text),
  public.marketplace_consent(uuid,uuid,boolean),public.marketplace_report(uuid,uuid,text),public.marketplace_contacts(uuid,uuid) to service_role;
commit;
