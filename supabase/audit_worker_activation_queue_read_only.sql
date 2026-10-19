-- Run only after the activation migration is confirmed in the production ledger.
-- Authorized auditor connection only. Aggregates only; no worker identifiers or contacts.
begin transaction read only;
set local statement_timeout = '15s';

with phones as (
  select w.id,w.owner_user_id,w.is_verified,w.available_now,
    case when length(digits)=10 then '1'||digits
      when length(digits) between 11 and 15 and left(digits,1)<>'0' then digits
      else null end as phone_key
  from public.workers w
  cross join lateral (select regexp_replace(coalesce(w.whatsapp_number,''),'[^0-9]','','g') digits) d
), classified as (
  select p.*,count(*) filter(where phone_key is not null) over(partition by phone_key) as phone_uses
  from phones p
), states as (
  select p.*,q.worker_id is not null as queued,q.invitation_permission_at,
    q.invitation_channel,q.suppressed_at,q.opted_out_at,q.unreachable_at,
    a.available as worker_confirmed_available,a.confirmed_at,a.access_expires_at,
    exists(select 1 from public.worker_activation_batch_recipients r where r.worker_id=p.id) as batched,
    exists(select 1 from public.worker_notification_consent c where c.worker_id=p.id
      and c.channel='whatsapp' and c.revoked_at is null) as future_whatsapp_consent
  from classified p
  left join public.worker_activation_queue q on q.worker_id=p.id
  left join public.worker_availability a on a.worker_id=p.id
)
select count(*) as total_profiles,
  count(*) filter(where queued) as queued_profiles,
  count(*) filter(where owner_user_id is not null) as linked_owners,
  count(*) filter(where phone_key is not null) as whatsapp_candidates,
  count(*) filter(where phone_key is not null and phone_uses>1) as shared_contact_profiles,
  count(*) filter(where invitation_permission_at is not null and invitation_channel='whatsapp') as whatsapp_invitation_permissions,
  count(*) filter(where suppressed_at is not null) as suppressed_profiles,
  count(*) filter(where opted_out_at is not null) as opted_out_profiles,
  count(*) filter(where unreachable_at is not null) as unreachable_profiles,
  count(*) filter(where future_whatsapp_consent) as future_whatsapp_job_consents,
  count(*) filter(where owner_user_id is not null and is_verified=true and available_now=true
    and worker_confirmed_available=true and access_expires_at>now()
    and confirmed_at>now()-interval '7 days' and confirmed_at<=now()) as currently_available,
  count(*) filter(where is_verified=true and phone_key is not null and phone_uses=1
    and invitation_permission_at is not null and invitation_channel='whatsapp'
    and suppressed_at is null and opted_out_at is null and unreachable_at is null
    and not batched) as eligible_for_draft
from states;

select status,count(*) as recipients from public.worker_activation_batch_recipients
  group by status order by status;
rollback;
