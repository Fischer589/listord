-- This migration replaces the unapplied rejection tombstone with an atomic
-- deletion of a pending registration and its unused activation queue entry.
-- All other worker references, including cascading payment/contact tables,
-- are protected. This function is callable only through the server role.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';

create function public.admin_delete_pending_worker(p_worker_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_worker record;
  v_queue record;
  v_reference record;
  v_has_reference boolean;
  v_deleted_id uuid;
begin
  if p_worker_id is null then return 'not_pending'; end if;

  -- The row lock serializes approval, child inserts (FK key-share locks), and
  -- concurrent deletion. A single RPC call is one PostgreSQL transaction.
  select w.id,w.is_verified,w.user_id,w.owner_user_id into v_worker
    from public.workers w where w.id=p_worker_id for update;
  if not found then return 'not_pending'; end if;
  if v_worker.is_verified is distinct from false then return 'not_pending'; end if;
  if v_worker.user_id is not null or v_worker.owner_user_id is not null then
    return 'protected';
  end if;

  select q.* into v_queue from public.worker_activation_queue q
    where q.worker_id=p_worker_id for update;
  if found then
    if v_queue.invitation_permission_at is not null
      or v_queue.invitation_evidence is not null
      or v_queue.invitation_channel is not null
      or v_queue.suppressed_at is not null
      or v_queue.suppression_reason is not null
      or v_queue.opted_out_at is not null
      or v_queue.unreachable_at is not null then
      return 'protected';
    end if;
  end if;

  -- Inspect every live FK, including future tables and ON DELETE CASCADE FKs.
  -- No non-queue referencing record is ever disposable by this workflow.
  for v_reference in
    select n.nspname as table_schema,c.relname as table_name,
      a.attname as column_name,
      pg_catalog.array_length(f.conkey,1) as source_keys,
      pg_catalog.array_length(f.confkey,1) as target_keys
    from pg_catalog.pg_constraint f
    join pg_catalog.pg_class c on c.oid=f.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    left join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attnum=f.conkey[1]
    where f.contype='f' and f.confrelid='public.workers'::pg_catalog.regclass
  loop
    if v_reference.source_keys is distinct from 1 or v_reference.target_keys is distinct from 1
      or v_reference.column_name is null then
      return 'protected';
    end if;
    if v_reference.table_schema='public'
      and v_reference.table_name='worker_activation_queue'
      and v_reference.column_name='worker_id' then
      continue;
    end if;
    execute pg_catalog.format(
      'select exists(select 1 from %I.%I where %I=$1)',
      v_reference.table_schema,v_reference.table_name,v_reference.column_name)
      into v_has_reference using p_worker_id;
    if v_has_reference then return 'protected'; end if;
  end loop;

  delete from public.worker_activation_queue where worker_id=p_worker_id;
  delete from public.workers where id=p_worker_id and is_verified=false
    returning id into v_deleted_id;
  if v_deleted_id is distinct from p_worker_id then
    raise exception 'Pending worker deletion did not remove the selected row';
  end if;
  if exists(select 1 from public.workers where id=p_worker_id) then
    raise exception 'Pending worker still exists after deletion';
  end if;
  return 'deleted';
end;
$$;

revoke all on function public.admin_delete_pending_worker(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_delete_pending_worker(uuid) to service_role;

commit;
