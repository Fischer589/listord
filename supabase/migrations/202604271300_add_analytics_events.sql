create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (
    event_name in (
      'page_view',
      'worker_view',
      'contact_click',
      'paywall_open',
      'checkout_start',
      'checkout_success'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_created_idx
on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_created_idx
on public.analytics_events (created_at desc);

alter table public.analytics_events enable row level security;
