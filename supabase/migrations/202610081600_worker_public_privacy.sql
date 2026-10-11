-- Worker privacy repair. Review the live catalog and deployed caller behavior.
-- Run as table owner in one transaction. No worker data/token/photo changes.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';
alter table public.workers enable row level security;
alter table public.contact_requests enable row level security;

-- Table-level REVOKE alone does not remove pre-existing column grants.
revoke all on public.workers from public, anon, authenticated;
do $$
declare c record;
begin
  for c in select attname from pg_attribute
    where attrelid='public.workers'::regclass and attnum>0 and not attisdropped
  loop
    execute format('revoke all (%I) on public.workers from public, anon, authenticated', c.attname);
  end loop;
end $$;

-- Explicit compatibility projection: homepage, public profile and matching only.
-- New columns remain private by default. No phone, owner ID or edit capability.
grant select (id, full_name, city, work_style, desired_income, short_intro, skills,
  photo_url, created_at, available_now, rating_average, rating_count, hired_count,
  experience, income_type, last_boosted_at, boost_expires_at, is_verified)
  on public.workers to anon, authenticated;

-- Restrictive policy ANDs with legacy permissive USING(true), including unknown
-- permissive policies. Keep existing owner policies for dependency review.
create policy workers_approved_public_guard on public.workers as restrictive
  for select to anon, authenticated using (is_verified is true);
create policy workers_approved_public_read on public.workers
  for select to anon, authenticated using (is_verified is true);
create policy workers_public_insert_guard on public.workers as restrictive
  for insert to anon, authenticated with check (false);
create policy workers_public_update_guard on public.workers as restrictive
  for update to anon, authenticated using (false) with check (false);
create policy workers_public_delete_guard on public.workers as restrictive
  for delete to anon, authenticated using (false);

-- Existing contact policies otherwise require SELECT(workers.user_id). A boolean
-- self-ownership check preserves their reads without granting that private column.
-- Owner must be the trusted migration role; never a client-controlled role.
create function public.owns_worker_profile(p_worker_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.workers w
    where w.id=p_worker_id and w.user_id=auth.uid() and auth.uid() is not null);
$$;
revoke all on function public.owns_worker_profile(uuid) from public, anon;
grant execute on function public.owns_worker_profile(uuid) to authenticated;
-- Policies apply only to authenticated callers, not anonymous callers.
drop policy if exists "Workers view requests for themselves" on public.contact_requests;
create policy "Workers view requests for themselves" on public.contact_requests
  for select to authenticated using (public.owns_worker_profile(worker_id));
-- Outcome links currently provide no authenticated participant identity. Direct
-- client UPDATE grants would also let one participant forge the other's answer.
-- Deny client mutations until a separately reviewed participant-scoped RPC exists.
-- Keep SELECT policies, financial records and service-role grants unchanged.
revoke insert, update, delete, truncate, references, trigger
  on public.contact_requests from public, anon, authenticated;
do $$
declare c record; r text;
begin
  for c in select attname from pg_attribute
    where attrelid='public.contact_requests'::regclass and attnum>0 and not attisdropped
  loop
    execute format('revoke insert (%I), update (%I), references (%I) on public.contact_requests from public, anon, authenticated', c.attname,c.attname,c.attname);
    foreach r in array array['anon','authenticated'] loop
      if has_column_privilege(r,'public.contact_requests',c.attname,'INSERT')
        or has_column_privilege(r,'public.contact_requests',c.attname,'UPDATE') then
        raise exception 'inherited contact write access remains for %',r;
      end if;
    end loop;
  end loop;
  foreach r in array array['anon','authenticated'] loop
    if has_table_privilege(r,'public.contact_requests','DELETE')
      or has_table_privilege(r,'public.contact_requests','TRUNCATE') then
      raise exception 'inherited destructive contact access remains for %',r;
    end if;
  end loop;
end $$;
create policy contact_public_insert_guard on public.contact_requests as restrictive
  for insert to anon, authenticated with check (false);
create policy contact_public_update_guard on public.contact_requests as restrictive
  for update to anon, authenticated using (false) with check (false);
create policy contact_public_delete_guard on public.contact_requests as restrictive
  for delete to anon, authenticated using (false);

-- Abort instead of silently leaving inherited role grants or RLS bypass exposed.
do $$
declare r text; c record;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists(select 1 from pg_roles where rolname=r and (rolsuper or rolbypassrls)) then
      raise exception 'client role bypasses row security: %', r;
    end if;
    for c in select attname from pg_attribute
      where attrelid='public.workers'::regclass and attnum>0 and not attisdropped loop
      if c.attname not in ('id','full_name','city','work_style','desired_income','short_intro',
        'skills','photo_url','created_at','available_now','rating_average','rating_count',
        'hired_count','experience','income_type','last_boosted_at','boost_expires_at','is_verified')
        and has_column_privilege(r,'public.workers',c.attname,'SELECT') then
        raise exception 'inherited private-column access remains for %', r;
      end if;
      if has_column_privilege(r,'public.workers',c.attname,'INSERT')
        or has_column_privilege(r,'public.workers',c.attname,'UPDATE') then
        raise exception 'inherited worker write access remains for %', r;
      end if;
    end loop;
    if has_table_privilege(r,'public.workers','DELETE')
      or has_table_privilege(r,'public.workers','TRUNCATE') then
      raise exception 'inherited destructive worker access remains for %', r;
    end if;
  end loop;
end $$;

-- Existing service_role grants are preserved, never granted to public clients.
-- Do NOT elevate legacy hiring-stat triggers: review those dependencies in staging.
commit;
