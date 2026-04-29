create extension if not exists pgcrypto;

alter table public.workers
add column if not exists edit_token text;

update public.workers
set edit_token = gen_random_uuid()::text
where edit_token is null
  or btrim(edit_token) = '';

alter table public.workers
alter column edit_token set default gen_random_uuid()::text,
alter column edit_token set not null;

create unique index if not exists workers_edit_token_unique_idx
on public.workers (edit_token);
