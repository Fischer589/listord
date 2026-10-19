-- Run only through the authorized production auditor connection. Aggregate output only.
-- This file never writes data or prints worker IDs, phone numbers, tokens, or evidence.
begin transaction read only;
set local statement_timeout = '15s';

select current_user as auditor_role, current_setting('transaction_read_only') as read_only,
  to_regclass('public.workers') is not null as workers_present,
  to_regclass('public.worker_availability') is not null as availability_present,
  to_regclass('public.worker_activation_queue') is not null as activation_queue_present,
  to_regclass('public.worker_activation_batch_recipients') is not null as activation_recipients_present,
  to_regclass('supabase_migrations.schema_migrations') is not null as migration_ledger_present;

with expected(signature) as (values
  ('public.issue_worker_availability(uuid,text)'),
  ('public.renew_worker_availability(text,boolean)'),
  ('public.marketplace_express_targets(uuid,uuid,uuid[])'),
  ('public.marketplace_express_reserve(uuid,uuid,text,uuid[])'),
  ('public.marketplace_express_chargeable(uuid)'),
  ('public.marketplace_express_claim(uuid)')
), definitions as (
  select signature,to_regprocedure(signature) as proc,
    pg_get_functiondef(to_regprocedure(signature)) as definition from expected
)
select signature,proc is not null as present,
  coalesce((length(definition)-length(replace(definition,'interval ''30 days''','')))
    /length('interval ''30 days'''),0) as thirty_day_guards,
  position('SECURITY DEFINER' in upper(coalesce(definition,'')))>0 as security_definer
from definitions order by signature;

select table_name, column_name, data_type from information_schema.columns
  where table_schema='public' and table_name in
    ('workers','worker_availability','worker_activation_queue','worker_activation_batch_recipients')
    and column_name in ('id','worker_id','owner_user_id','is_verified','available_now',
      'whatsapp_number','confirmed_at','access_expires_at','invitation_permission_at',
      'invitation_channel','suppressed_at','opted_out_at','unreachable_at','status')
  order by table_name,column_name;

-- Existing production inventory. A normalized phone is only a contact candidate.
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
)
select count(*) as total_profiles,
  count(*) filter(where is_verified=true) as approved_profiles,
  count(*) filter(where owner_user_id is not null) as linked_owners,
  count(*) filter(where phone_key is not null) as whatsapp_candidates,
  count(*) filter(where phone_key is not null and phone_uses>1) as shared_contact_profiles,
  count(*) filter(where phone_key is null) as no_usable_contact,
  count(*) filter(where owner_user_id is null) as needs_independent_ownership_review
from classified;

select count(*) filter(where w.owner_user_id is not null and w.is_verified=true
    and w.available_now=true and a.available=true and a.access_expires_at>now()
    and a.confirmed_at>now()-interval '7 days' and a.confirmed_at<=now()) as currently_available,
  count(*) filter(where a.confirmed_at is not null and
    (a.available=false or a.confirmed_at<=now()-interval '7 days')) as unavailable_or_expired
from public.workers w left join public.worker_availability a on a.worker_id=w.id;

-- Run the queue and availability portions after the preceding catalog output
-- confirms the production schema matches the reviewed migration. Do not infer
-- invitation permission or suppression from the queries above.
rollback;
