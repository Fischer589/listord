-- CANDIDATE / UNAPPLIED. Production catalog preflight found that both legacy
-- SECURITY DEFINER RPCs are executable by anon and authenticated despite older
-- migrations revoking only PUBLIC. Preserve the service-role webhook/contact
-- path and all payment, worker and contact records.
begin;

revoke all on function public.activate_worker_boost(uuid, text, integer, text)
  from public, anon, authenticated;
revoke all on function public.claim_worker_contact(text, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_worker_boost(uuid, text, integer, text)
  to service_role;
grant execute on function public.claim_worker_contact(text, uuid)
  to service_role;

do $$
declare function_name regprocedure;
begin
  foreach function_name in array array[
    'public.activate_worker_boost(uuid,text,integer,text)'::regprocedure,
    'public.claim_worker_contact(text,uuid)'::regprocedure
  ] loop
    if has_function_privilege('anon', function_name, 'EXECUTE')
      or has_function_privilege('authenticated', function_name, 'EXECUTE')
      or not has_function_privilege('service_role', function_name, 'EXECUTE') then
      raise exception 'unsafe effective EXECUTE privilege on %', function_name;
    end if;
  end loop;
end $$;

commit;
