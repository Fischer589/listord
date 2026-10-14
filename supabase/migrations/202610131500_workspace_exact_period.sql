-- Every newly paid one-time Workspace order grants exactly 30 days.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';
alter table public.employer_workspace_orders
  add constraint employer_workspace_exact_30d
  check (status <> 'paid' or access_until = paid_at + interval '720 hours') not valid;
commit;
