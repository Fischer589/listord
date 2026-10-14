-- Keep ownership, applications, payment records and lifecycle events after admin removal.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

alter table public.marketplace_opportunities
  add column deleted_at timestamptz;
create index marketplace_not_deleted_idx on public.marketplace_opportunities (created_at desc)
  where deleted_at is null;

drop policy marketplace_browse_open on public.marketplace_opportunities;
create policy marketplace_browse_open on public.marketplace_opportunities
  for select to anon, authenticated
  using (deleted_at is null and status = 'open' and moderation_status = 'approved' and expires_at > now());

create function public.marketplace_guard_deletion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'ALREADY_DELETED';
  end if;
  if old.deleted_at is not null and new.status <> 'closed' then
    raise exception 'ALREADY_DELETED';
  end if;
  if new.deleted_at is not null and new.status <> 'closed' then
    raise exception 'DELETED_MUST_BE_CLOSED';
  end if;
  return new;
end $$;
create trigger marketplace_guard_deletion before update on public.marketplace_opportunities
  for each row execute function public.marketplace_guard_deletion();
revoke all on function public.marketplace_guard_deletion() from public, anon, authenticated;

create function public.marketplace_soft_delete(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare removed_at timestamptz;
begin
  select deleted_at into removed_at from public.marketplace_opportunities where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if removed_at is not null then return false; end if;
  -- A Checkout already bound to Stripe must be expired by the server first.
  if exists (select 1 from public.marketplace_featured_orders
    where opportunity_id = p_id and status = 'pending' and stripe_session_id is not null) then
    raise exception 'CHECKOUT_STILL_OPEN';
  end if;
  update public.marketplace_featured_orders set status = 'failed'
    where opportunity_id = p_id and status = 'pending';
  update public.marketplace_opportunities set status = 'closed', deleted_at = now() where id = p_id;
  insert into public.marketplace_events(opportunity_id, kind) values(p_id, 'admin_deleted');
  return true;
end $$;
revoke all on function public.marketplace_soft_delete(uuid) from public, anon, authenticated;
grant execute on function public.marketplace_soft_delete(uuid) to service_role;
commit;
