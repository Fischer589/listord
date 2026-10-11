-- Private availability ledger. Deploy only after policy remediation.
-- Existing worker IDs, photos, tokens, payments and availability are not backfilled.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';
create table public.worker_availability (
  worker_id uuid primary key references public.workers(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  access_expires_at timestamptz not null,
  available boolean not null default false,
  confirmed_at timestamptz,
  issued_at timestamptz not null default now(),
  ownership_verified_at timestamptz not null default now(),
  check (not available or confirmed_at is not null)
);
alter table public.worker_availability enable row level security;
revoke all on public.worker_availability from public, anon, authenticated;
grant select, insert, update on public.worker_availability to service_role;

-- Only the server issues fresh 256-bit secrets AFTER authorized owner verification.
-- Reissue invalidates the old private link and does not imply availability.
create function public.issue_worker_availability(p_worker_id uuid, p_token_hash text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.workers where id=p_worker_id and is_verified=true for update;
  if not found then raise exception 'worker unavailable'; end if;
  insert into public.worker_availability(worker_id, token_hash, access_expires_at)
    values(p_worker_id, p_token_hash, now() + interval '180 days')
    on conflict(worker_id) do update set token_hash=excluded.token_hash,
      access_expires_at=excluded.access_expires_at, available=false, confirmed_at=null,
      issued_at=now(), ownership_verified_at=now();
end;
$$;

create function public.renew_worker_availability(p_token_hash text, p_available boolean)
returns table(available boolean, confirmed_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare v_worker uuid;
begin
  if p_available is null then raise exception 'invalid availability'; end if;
  -- Consistent worker -> availability lock order with issuance; recheck after lock.
  select a.worker_id into v_worker from public.worker_availability a
    where a.token_hash=p_token_hash and a.access_expires_at > now();
  if v_worker is null then return; end if;
  perform 1 from public.workers w where w.id=v_worker and w.is_verified=true for update;
  if not found then return; end if;
  update public.worker_availability a set available=p_available, confirmed_at=now()
    where a.worker_id=v_worker and a.token_hash=p_token_hash and a.access_expires_at > now();
  if not found then return; end if;
  update public.workers set available_now=p_available where id=v_worker;
  return query select a.available, a.confirmed_at from public.worker_availability a where a.worker_id=v_worker;
end;
$$;
revoke all on function public.issue_worker_availability(uuid,text) from public, anon, authenticated;
revoke all on function public.renew_worker_availability(text,boolean) from public, anon, authenticated;
grant execute on function public.issue_worker_availability(uuid,text) to service_role;
grant execute on function public.renew_worker_availability(text,boolean) to service_role;
commit;
