alter table public.premium_access
add column if not exists whatsapp_number text,
add column if not exists stripe_subscription_id text,
add column if not exists status text not null default 'active';

alter table public.premium_access
drop constraint if exists premium_access_status_check;

alter table public.premium_access
add constraint premium_access_status_check
check (status in ('active', 'inactive', 'canceled', 'past_due'));

create index if not exists premium_access_whatsapp_number_idx
on public.premium_access (whatsapp_number);

create index if not exists premium_access_status_idx
on public.premium_access (status);

update public.premium_access pa
set whatsapp_number =
  case
    when length(regexp_replace(es.whatsapp_number, '\D', '', 'g')) = 10
      then '+1' || regexp_replace(es.whatsapp_number, '\D', '', 'g')
    else '+' || regexp_replace(es.whatsapp_number, '\D', '', 'g')
  end
from public.employer_sessions es
where pa.browser_session_id = es.browser_session_id
  and pa.whatsapp_number is null
  and es.whatsapp_number is not null
  and length(regexp_replace(es.whatsapp_number, '\D', '', 'g')) >= 10;

alter table public.browser_sessions
alter column free_contacts_remaining set default 1;

update public.browser_sessions
set free_contacts_remaining = 1
where free_contacts_remaining > 1;

alter table public.employers
alter column free_contacts_remaining set default 1;

update public.employers
set free_contacts_remaining = 1
where free_contacts_remaining > 1;

create or replace function public.claim_worker_contact(
  p_browser_session_id text,
  p_worker_id uuid
)
returns table (
  allowed boolean,
  reason text,
  free_contacts_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_attempts integer;
  remaining_contacts integer;
begin
  if p_browser_session_id is null or btrim(p_browser_session_id) = '' then
    return query select false, 'missing_session', 0;
    return;
  end if;

  if not exists (
    select 1
    from public.workers
    where id = p_worker_id
      and is_verified = true
      and whatsapp_number is not null
      and btrim(whatsapp_number) <> ''
  ) then
    return query select false, 'worker_unavailable', 0;
    return;
  end if;

  select count(*)::integer
  into recent_attempts
  from public.contact_attempts
  where browser_session_id = p_browser_session_id
    and created_at >= now() - interval '1 minute';

  if recent_attempts >= 5 then
    return query select false, 'rate_limited', 0;
    return;
  end if;

  insert into public.contact_attempts (browser_session_id, worker_id)
  values (p_browser_session_id, p_worker_id);

  if exists (
    select 1
    from public.premium_access
    where browser_session_id = p_browser_session_id
      and status = 'active'
      and paid_access_until > now()
  ) then
    select coalesce(bs.free_contacts_remaining, 1)
    into remaining_contacts
    from public.browser_sessions bs
    where bs.id = p_browser_session_id;

    return query select true, 'premium', coalesce(remaining_contacts, 1);
    return;
  end if;

  insert into public.browser_sessions (id)
  values (p_browser_session_id)
  on conflict (id) do nothing;

  update public.browser_sessions
  set
    free_contacts_remaining = free_contacts_remaining - 1,
    updated_at = now()
  where id = p_browser_session_id
    and free_contacts_remaining > 0
  returning public.browser_sessions.free_contacts_remaining
  into remaining_contacts;

  if remaining_contacts is null then
    select bs.free_contacts_remaining
    into remaining_contacts
    from public.browser_sessions bs
    where bs.id = p_browser_session_id;

    return query select false, 'payment_required', coalesce(remaining_contacts, 0);
    return;
  end if;

  return query select true, 'free_contact', remaining_contacts;
end;
$$;
