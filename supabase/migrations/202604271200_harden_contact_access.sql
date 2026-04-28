create table if not exists public.browser_sessions (
  id text primary key,
  free_contacts_remaining integer not null default 2 check (free_contacts_remaining >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_attempts (
  id uuid primary key default gen_random_uuid(),
  browser_session_id text not null,
  worker_id uuid not null references public.workers(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists contact_attempts_session_created_idx
on public.contact_attempts (browser_session_id, created_at desc);

alter table public.browser_sessions enable row level security;
alter table public.contact_attempts enable row level security;

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
      and paid_access_until > now()
  ) then
    select coalesce(bs.free_contacts_remaining, 2)
    into remaining_contacts
    from public.browser_sessions bs
    where bs.id = p_browser_session_id;

    return query select true, 'premium', coalesce(remaining_contacts, 2);
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

revoke all on function public.claim_worker_contact(text, uuid) from public;
grant execute on function public.claim_worker_contact(text, uuid) to service_role;
