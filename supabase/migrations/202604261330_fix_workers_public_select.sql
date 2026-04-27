alter table public.workers enable row level security;

drop policy if exists "Workers are public to browse" on public.workers;

create policy "Workers are public to browse"
on public.workers for select
to anon, authenticated
using (true);
