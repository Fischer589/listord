alter table public.workers
alter column desired_income set default 0,
alter column short_intro set default '';

update public.workers
set
  desired_income = coalesce(desired_income, 0),
  short_intro = coalesce(short_intro, '');
