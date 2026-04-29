alter table public.workers
add column if not exists updated_at timestamptz not null default now();

create table if not exists public.employer_sessions (
  id uuid primary key default gen_random_uuid(),
  browser_session_id text not null unique,
  whatsapp_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employer_sessions_browser_session_idx
on public.employer_sessions (browser_session_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workers_set_updated_at on public.workers;
create trigger workers_set_updated_at
before update on public.workers
for each row
execute function public.set_updated_at();

drop trigger if exists employer_sessions_set_updated_at on public.employer_sessions;
create trigger employer_sessions_set_updated_at
before update on public.employer_sessions
for each row
execute function public.set_updated_at();

alter table public.employer_sessions enable row level security;
