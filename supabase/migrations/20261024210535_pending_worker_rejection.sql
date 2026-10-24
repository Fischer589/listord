-- Reject pending registrations without deleting profiles referenced by
-- activation, marketplace, contact, or payment history.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';

alter table public.workers add column rejected_at timestamptz;
alter table public.workers add constraint workers_rejected_not_verified
  check (rejected_at is null or is_verified is false);
revoke all (rejected_at) on public.workers from public, anon, authenticated;
comment on column public.workers.rejected_at is
  'Admin rejection tombstone. Referenced worker and financial records remain intact.';

commit;
