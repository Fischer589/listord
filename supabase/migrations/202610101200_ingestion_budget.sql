-- Additive ingestion budget only. Historical phone conflicts are handled separately.
-- No legacy records, contacts or credentials change.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';
create table public.marketplace_ingestion_limits (
  action text not null, subject text not null, bucket timestamptz not null,
  attempts integer not null check(attempts > 0), primary key(action,subject,bucket)
);
alter table public.marketplace_ingestion_limits enable row level security;
revoke all on public.marketplace_ingestion_limits from public,anon,authenticated;
grant all on public.marketplace_ingestion_limits to service_role;
create function public.marketplace_ingestion_budget(p_action text,p_subject text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer; cap integer;
begin
  if p_action is null or p_action not in ('registration','analytics') or p_subject is null or p_subject !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_BUDGET'; end if;
  cap := case when p_action='registration' then 100 else 6000 end;
  -- Stable lock order: global before subject. Limit updates also serialize callers.
  insert into public.marketplace_ingestion_limits values(p_action,'global',date_trunc('hour',now()),1)
    on conflict(action,subject,bucket) do update set attempts=least(marketplace_ingestion_limits.attempts+1,cap+1)
    returning attempts into n;
  if n>cap then return false; end if;
  if p_action='registration' then
    insert into public.marketplace_ingestion_limits values(p_action,p_subject,date_trunc('hour',now()),1)
      on conflict(action,subject,bucket) do update set attempts=least(marketplace_ingestion_limits.attempts+1,6)
      returning attempts into n;
    if n>5 then return false; end if;
  end if;
  -- Bounded retention, no profile/contact content is ever stored.
  delete from public.marketplace_ingestion_limits where bucket<now()-interval '48 hours';
  return true;
end $$;
revoke all on function public.marketplace_ingestion_budget(text,text) from public,anon,authenticated;
grant execute on function public.marketplace_ingestion_budget(text,text) to service_role;
commit;
