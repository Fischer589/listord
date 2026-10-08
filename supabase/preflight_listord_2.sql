-- READ ONLY. Run only in an explicitly authorized production inspection.
-- No worker names, phone numbers, tokens, addresses or payment identifiers.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name in
  ('workers', 'employers', 'employer_requests', 'worker_boosts', 'employer_payments', 'premium_access')
order by table_name, ordinal_position;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;

select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'workers'
order by grantee, column_name;

select count(*) as worker_count, count(photo_url) as workers_with_photo,
  count(*) filter (where user_id is not null) as linked_accounts
from public.workers;

select id, public, file_size_limit, allowed_mime_types from storage.buckets;
select bucket_id, count(*) as object_count from storage.objects group by bucket_id;
