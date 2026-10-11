-- Add profile identity to authorized contact results. Shared WhatsApp numbers
-- do not identify a worker; the old RPC stays available for older clients.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create function public.marketplace_contacts_v2(p_actor uuid,p_id uuid,p_worker uuid)
returns table(name text,phone text,worker_id uuid,worker_name text)
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.marketplace_opportunities
    where id=p_id and status='open' and moderation_status='approved' and expires_at>now() for share;
  if not found then raise exception 'NOT_OPEN'; end if;
  perform public.marketplace_throttle(p_actor,'contact',60);
  if exists(select 1 from public.marketplace_opportunity_owners
    where opportunity_id=p_id and owner_user_id=p_actor) then
    return query select w.full_name,w.whatsapp_number,w.id,w.full_name
      from public.marketplace_interests i join public.workers w on w.id=i.worker_id
      where i.opportunity_id=p_id and i.decision='interested' and w.is_verified
        and w.owner_user_id=i.decision_user_id order by i.updated_at limit 50;
  elsif p_worker is not null and exists(
    select 1 from public.marketplace_interests i join public.workers w on w.id=i.worker_id
    where i.opportunity_id=p_id and i.worker_id=p_worker and i.decision='interested'
      and w.is_verified and w.owner_user_id=p_actor and i.decision_user_id=p_actor
  ) then
    return query select o.contact_name,o.whatsapp_number,w.id,w.full_name
      from public.marketplace_opportunity_owners o cross join public.workers w
      where o.opportunity_id=p_id and w.id=p_worker and w.owner_user_id=p_actor;
  else raise exception 'OWNERSHIP_REQUIRED';
  end if;
end $$;

revoke all on function public.marketplace_contacts_v2(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.marketplace_contacts_v2(uuid,uuid,uuid) to service_role;
commit;
