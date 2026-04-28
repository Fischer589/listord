alter table public.workers
add column if not exists is_verified boolean not null default false;

create index if not exists workers_is_verified_idx
on public.workers (is_verified);

drop policy if exists "Workers are public to browse" on public.workers;

create policy "Workers are public to browse"
on public.workers for select
to anon, authenticated
using (is_verified = true);

drop policy if exists "Anyone can submit an unverified worker profile" on public.workers;

create policy "Anyone can submit an unverified worker profile"
on public.workers for insert
to anon, authenticated
with check (is_verified = false);
