-- Public clients may count approved profiles but cannot read unmoderated free text
-- directly from PostgREST. Server projections scrub contact text before delivery.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';
revoke select (full_name, city, short_intro, skills, experience, photo_url)
  on public.workers from public, anon, authenticated;
do $$
declare role_name text; column_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    foreach column_name in array array['full_name','city','short_intro','skills','experience','photo_url'] loop
      if has_column_privilege(role_name, 'public.workers', column_name, 'SELECT') then
        raise exception 'public contact-bearing preview remains readable: %.%', role_name, column_name;
      end if;
    end loop;
  end loop;
end $$;
commit;
