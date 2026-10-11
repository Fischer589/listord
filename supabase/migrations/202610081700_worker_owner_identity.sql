-- UNAPPLIED 2.0 candidate. Run only after worker_public_privacy has removed
-- table-wide client SELECT; otherwise a new owner ID would be public at once.
-- Nullable by design: historical worker ownership is never inferred or backfilled.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';

do $$
begin
  if to_regclass('public.workers') is null or to_regclass('auth.users') is null then
    raise exception 'worker identity dependencies are missing';
  end if;
  if exists(select 1 from pg_attribute where attrelid='public.workers'::regclass
      and attname='owner_user_id' and attnum>0 and not attisdropped) then
    raise exception 'worker owner column already exists; reconcile before applying';
  end if;
  if not exists(select 1 from pg_policy where polrelid='public.workers'::regclass
      and polname='workers_approved_public_guard')
    or has_table_privilege('anon','public.workers','SELECT')
    or has_table_privilege('authenticated','public.workers','SELECT')
    or has_column_privilege('anon','public.workers','edit_token','SELECT')
    or has_column_privilege('authenticated','public.workers','edit_token','SELECT') then
    raise exception 'worker privacy repair required before owner identity';
  end if;
end $$;

alter table public.workers add column owner_user_id uuid
  references auth.users(id) on delete restrict;
revoke all (owner_user_id) on public.workers from public, anon, authenticated;

do $$
begin
  if has_column_privilege('anon','public.workers','owner_user_id','SELECT')
    or has_column_privilege('authenticated','public.workers','owner_user_id','SELECT')
    or not has_column_privilege('service_role','public.workers','owner_user_id','UPDATE') then
    raise exception 'unsafe worker owner column privileges';
  end if;
end $$;
commit;
