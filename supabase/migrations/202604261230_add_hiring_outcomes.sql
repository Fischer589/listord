create type public.hiring_outcome as enum ('pending', 'hired', 'not_hired');

alter table public.workers
add column hired_count integer not null default 0 check (hired_count >= 0),
add column hire_rate numeric(5, 2) not null default 0 check (hire_rate >= 0 and hire_rate <= 100);

alter table public.employers
add column successful_hires_count integer not null default 0 check (successful_hires_count >= 0);

alter table public.contact_requests
add column outcome public.hiring_outcome not null default 'pending',
add column outcome_confirmed_by_employer boolean,
add column outcome_confirmed_by_worker boolean,
add column outcome_note text;

create index contact_requests_outcome_idx on public.contact_requests (outcome);

create or replace function public.set_contact_request_outcome()
returns trigger
language plpgsql
as $$
begin
  if new.outcome_confirmed_by_employer is true
    and new.outcome_confirmed_by_worker is true then
    new.outcome := 'hired';
  elsif new.outcome_confirmed_by_employer is false
    and new.outcome_confirmed_by_worker is false then
    new.outcome := 'not_hired';
  else
    new.outcome := 'pending';
  end if;

  return new;
end;
$$;

create or replace function public.refresh_hiring_stats(
  worker_id_to_refresh uuid,
  employer_id_to_refresh uuid
)
returns void
language plpgsql
as $$
begin
  update public.workers
  set
    hired_count = (
      select count(*)::integer
      from public.contact_requests
      where worker_id = worker_id_to_refresh
        and outcome = 'hired'
    ),
    hire_rate = coalesce((
      select round(
        100.0 * count(*) filter (where outcome = 'hired')
        / nullif(count(*) filter (where outcome in ('hired', 'not_hired')), 0),
        2
      )
      from public.contact_requests
      where worker_id = worker_id_to_refresh
    ), 0)
  where id = worker_id_to_refresh;

  update public.employers
  set successful_hires_count = (
    select count(*)::integer
    from public.contact_requests
    where employer_id = employer_id_to_refresh
      and outcome = 'hired'
  )
  where id = employer_id_to_refresh;
end;
$$;

create or replace function public.refresh_hiring_stats_after_request()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_hiring_stats(old.worker_id, old.employer_id);
    return old;
  end if;

  perform public.refresh_hiring_stats(new.worker_id, new.employer_id);

  if tg_op = 'UPDATE'
    and (old.worker_id <> new.worker_id or old.employer_id <> new.employer_id) then
    perform public.refresh_hiring_stats(old.worker_id, old.employer_id);
  end if;

  return new;
end;
$$;

create trigger contact_requests_set_outcome
before insert or update of outcome_confirmed_by_employer, outcome_confirmed_by_worker
on public.contact_requests
for each row
execute function public.set_contact_request_outcome();

create trigger contact_requests_refresh_hiring_stats
after insert or update of outcome, worker_id, employer_id or delete
on public.contact_requests
for each row
execute function public.refresh_hiring_stats_after_request();

create policy "Employers update their outcome answer"
on public.contact_requests for update
using (
  exists (
    select 1
    from public.employers
    where employers.id = contact_requests.employer_id
      and employers.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.employers
    where employers.id = contact_requests.employer_id
      and employers.user_id = auth.uid()
  )
);

create policy "Workers update their outcome answer"
on public.contact_requests for update
using (
  exists (
    select 1
    from public.workers
    where workers.id = contact_requests.worker_id
      and workers.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workers
    where workers.id = contact_requests.worker_id
      and workers.user_id = auth.uid()
  )
);
