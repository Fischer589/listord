do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workers'
      and column_name = 'job_duration_preference'
  ) then
    alter table public.workers
    alter column job_duration_preference set default 'flexible';

    update public.workers
    set job_duration_preference = 'flexible'
    where job_duration_preference is null
      or btrim(job_duration_preference) = '';
  end if;
end $$;
