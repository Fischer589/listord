create type public.work_style as enum (
  'structured',
  'creative',
  'hands_on',
  'people_oriented',
  'systems_oriented',
  'fast_paced',
  'detail_oriented',
  'flexible'
);

alter table public.workers
add column work_style public.work_style,
add column work_style_note text;

create index workers_work_style_idx on public.workers (work_style);
