-- Authorized SQL administrator READ-ONLY preflight. No worker values/secrets.
begin transaction read only;
select c.relname, c.relrowsecurity, c.relforcerowsecurity,
  pg_get_userbyid(c.relowner) as owner, c.relacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('workers','contact_requests','worker_availability');
select * from pg_policies where schemaname='public'
  and tablename in ('workers','contact_requests','worker_availability');
select table_name, grantee, privilege_type from information_schema.table_privileges
where table_schema='public' and table_name in ('workers','contact_requests','worker_availability');
select column_name, grantee, privilege_type from information_schema.column_privileges
where table_schema='public' and table_name='workers';
select rolname, rolsuper, rolbypassrls, rolinherit from pg_roles
where rolname in ('anon','authenticated','service_role');
select pg_get_userbyid(roleid) as inherited_role, pg_get_userbyid(member) as member
from pg_auth_members;
-- Views / materialized views may leak through owner privileges. Review every
-- dependent object; this list is not a complete dynamic SQL dependency analysis.
select distinct n.nspname, c.relname, c.relkind, c.relacl, c.reloptions
from pg_depend d join pg_rewrite r on r.oid=d.objid
join pg_class c on c.oid=r.ev_class join pg_namespace n on n.oid=c.relnamespace
where d.refobjid='public.workers'::regclass;
-- Review bodies privately in the SQL console; do not export function source that
-- might contain hardcoded credentials. Include invoker functions/dynamic SQL.
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef, p.proacl, p.proconfig, pg_get_userbyid(p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','auth') order by n.nspname,p.proname;
select tgname, tgfoid::regprocedure from pg_trigger
where tgrelid in ('public.workers'::regclass,'public.contact_requests'::regclass) and not tgisinternal;
select count(*) as total, count(*) filter(where is_verified) as approved,
  count(*) filter(where is_verified and available_now) as declared_available
from public.workers;
rollback;
