create extension if not exists pgcrypto;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'worker-photos',
  'worker-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create type public.income_type as enum ('hourly', 'daily', 'weekly', 'monthly');
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
create type public.contact_request_status as enum ('pending', 'accepted', 'rejected');
create type public.hiring_outcome as enum ('pending', 'hired', 'not_hired');

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  photo_url text,
  country text not null default 'Dominican Republic',
  region text not null default 'Nacional',
  city text not null,
  whatsapp_number text,
  skills text[] not null default '{}',
  desired_income numeric(12, 2) not null,
  income_type public.income_type not null default 'daily',
  availability text[] not null default '{}',
  available_now boolean not null default false,
  work_style public.work_style,
  work_style_note text,
  job_duration_preference text not null,
  duration_note text,
  short_intro text not null,
  experience text,
  show_up_count integer not null default 0 check (show_up_count >= 0),
  completed_jobs_count integer not null default 0 check (completed_jobs_count >= 0),
  hired_count integer not null default 0 check (hired_count >= 0),
  hire_rate numeric(5, 2) not null default 0 check (hire_rate >= 0 and hire_rate <= 100),
  rating_average numeric(3, 2) not null default 0 check (rating_average >= 0 and rating_average <= 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  company_name text,
  contact_name text not null,
  country text not null default 'Dominican Republic',
  region text not null default 'Nacional',
  city text not null,
  whatsapp_number text not null,
  is_paid_employer boolean not null default false,
  paid_access_until timestamptz,
  free_contacts_remaining integer not null default 2 check (free_contacts_remaining >= 0),
  successful_hires_count integer not null default 0 check (successful_hires_count >= 0),
  created_at timestamptz not null default now()
);

create table public.premium_access (
  id uuid primary key default gen_random_uuid(),
  browser_session_id text,
  stripe_checkout_session_id text not null unique,
  stripe_customer_id text,
  plan text not null check (plan in ('weekly', 'monthly')),
  paid_access_until timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.browser_sessions (
  id text primary key,
  free_contacts_remaining integer not null default 2 check (free_contacts_remaining >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_attempts (
  id uuid primary key default gen_random_uuid(),
  browser_session_id text not null,
  worker_id uuid not null references public.workers(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.analytics_events (
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

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  status public.contact_request_status not null default 'pending',
  outcome public.hiring_outcome not null default 'pending',
  outcome_confirmed_by_employer boolean,
  outcome_confirmed_by_worker boolean,
  outcome_note text,
  created_at timestamptz not null default now(),
  unique (employer_id, worker_id)
);

create index workers_available_now_idx on public.workers (available_now);
create index workers_city_idx on public.workers (city);
create index workers_skills_idx on public.workers using gin (skills);
create index workers_work_style_idx on public.workers (work_style);
create index workers_is_verified_idx on public.workers (is_verified);
create unique index workers_whatsapp_digits_unique_idx
on public.workers ((regexp_replace(whatsapp_number, '\D', '', 'g')))
where whatsapp_number is not null
  and regexp_replace(whatsapp_number, '\D', '', 'g') <> '';
create index workers_rating_idx on public.workers (rating_average desc);
create index contact_requests_worker_idx on public.contact_requests (worker_id);
create index contact_requests_outcome_idx on public.contact_requests (outcome);
create index premium_access_browser_session_idx on public.premium_access (browser_session_id);
create index premium_access_paid_until_idx on public.premium_access (paid_access_until);
create index contact_attempts_session_created_idx on public.contact_attempts (browser_session_id, created_at desc);
create index analytics_events_event_created_idx on public.analytics_events (event_name, created_at desc);
create index analytics_events_created_idx on public.analytics_events (created_at desc);

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

create or replace function public.claim_worker_contact(
  p_browser_session_id text,
  p_worker_id uuid
)
returns table (
  allowed boolean,
  reason text,
  free_contacts_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_attempts integer;
  remaining_contacts integer;
begin
  if p_browser_session_id is null or btrim(p_browser_session_id) = '' then
    return query select false, 'missing_session', 0;
    return;
  end if;

  if not exists (
    select 1
    from public.workers
    where id = p_worker_id
      and is_verified = true
      and whatsapp_number is not null
      and btrim(whatsapp_number) <> ''
  ) then
    return query select false, 'worker_unavailable', 0;
    return;
  end if;

  select count(*)::integer
  into recent_attempts
  from public.contact_attempts
  where browser_session_id = p_browser_session_id
    and created_at >= now() - interval '1 minute';

  if recent_attempts >= 5 then
    return query select false, 'rate_limited', 0;
    return;
  end if;

  insert into public.contact_attempts (browser_session_id, worker_id)
  values (p_browser_session_id, p_worker_id);

  if exists (
    select 1
    from public.premium_access
    where browser_session_id = p_browser_session_id
      and paid_access_until > now()
  ) then
    select coalesce(bs.free_contacts_remaining, 2)
    into remaining_contacts
    from public.browser_sessions bs
    where bs.id = p_browser_session_id;

    return query select true, 'premium', coalesce(remaining_contacts, 2);
    return;
  end if;

  insert into public.browser_sessions (id)
  values (p_browser_session_id)
  on conflict (id) do nothing;

  update public.browser_sessions
  set
    free_contacts_remaining = free_contacts_remaining - 1,
    updated_at = now()
  where id = p_browser_session_id
    and free_contacts_remaining > 0
  returning public.browser_sessions.free_contacts_remaining
  into remaining_contacts;

  if remaining_contacts is null then
    select bs.free_contacts_remaining
    into remaining_contacts
    from public.browser_sessions bs
    where bs.id = p_browser_session_id;

    return query select false, 'payment_required', coalesce(remaining_contacts, 0);
    return;
  end if;

  return query select true, 'free_contact', remaining_contacts;
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

alter table public.workers enable row level security;
alter table public.employers enable row level security;
alter table public.premium_access enable row level security;
alter table public.browser_sessions enable row level security;
alter table public.contact_attempts enable row level security;
alter table public.analytics_events enable row level security;
alter table public.contact_requests enable row level security;

revoke all on function public.claim_worker_contact(text, uuid) from public;
grant execute on function public.claim_worker_contact(text, uuid) to service_role;

create policy "Workers are public to browse"
on public.workers for select
to anon, authenticated
using (is_verified = true);

create policy "Anyone can submit an unverified worker profile"
on public.workers for insert
to anon, authenticated
with check (is_verified = false);

create policy "Workers manage their own profile"
on public.workers for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Employers manage their own profile"
on public.employers for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Employers create their contact requests"
on public.contact_requests for insert
with check (
  exists (
    select 1
    from public.employers
    where employers.id = contact_requests.employer_id
      and employers.user_id = auth.uid()
  )
);

create policy "Employers view their contact requests"
on public.contact_requests for select
using (
  exists (
    select 1
    from public.employers
    where employers.id = contact_requests.employer_id
      and employers.user_id = auth.uid()
  )
);

create policy "Workers view requests for themselves"
on public.contact_requests for select
using (
  exists (
    select 1
    from public.workers
    where workers.id = contact_requests.worker_id
      and workers.user_id = auth.uid()
  )
);

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

insert into public.workers (
  full_name,
  photo_url,
  region,
  city,
  whatsapp_number,
  skills,
  desired_income,
  income_type,
  availability,
  available_now,
  work_style,
  work_style_note,
  job_duration_preference,
  duration_note,
  short_intro,
  experience,
  show_up_count,
  completed_jobs_count,
  hired_count,
  hire_rate,
  rating_average,
  rating_count
) values
(
  'Mariela Santos',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
  'Distrito Nacional',
  'Santo Domingo',
  '+18090000001',
  array['Limpieza', 'Cocina', 'Cuidado de hogar'],
  1800,
  'daily',
  array['Hoy', 'Mananas', 'Fines de semana'],
  true,
  'structured',
  'Me va mejor cuando el trabajo esta claro desde el inicio.',
  'Por dia o fijo semanal',
  'Puede empezar hoy si confirma temprano.',
  'Soy responsable, llego temprano y puedo empezar hoy.',
  '5 años en casas y apartamentos.',
  42,
  38,
  19,
  76,
  4.9,
  21
),
(
  'Joel Ramirez',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  'Santiago',
  'Santiago de los Caballeros',
  '+18090000002',
  array['Construccion', 'Pintura', 'Ayudante'],
  2200,
  'daily',
  array['Hoy', 'Semana completa'],
  true,
  'hands_on',
  'Prefiero resolver con las manos y ver avance rapido.',
  '1 semana o mas',
  'Disponible para obra corta o larga.',
  'Trabajo bien, aprendo rápido y me gusta cumplir.',
  'Obras residenciales y pintura interior.',
  31,
  29,
  14,
  70,
  4.8,
  16
),
(
  'Ana Peralta',
  'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?auto=format&fit=crop&w=600&q=80',
  'La Altagracia',
  'Higüey',
  '+18090000003',
  array['Ventas', 'Caja', 'Atención al cliente'],
  18500,
  'monthly',
  array['Tardes', 'Noches', 'Fines de semana'],
  false,
  'people_oriented',
  'Me siento efectiva hablando con clientes y ayudando.',
  'Fijo mensual',
  'Puede iniciar en 3 días.',
  'Me gusta atender bien a la gente y resolver sin dar vueltas.',
  'Tiendas, colmados y caja.',
  18,
  15,
  7,
  58,
  4.7,
  9
),
(
  'Luis Miguel Peña',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
  'Distrito Nacional',
  'Santo Domingo',
  '+18090000004',
  array['Delivery', 'Mensajería', 'Compras'],
  1500,
  'daily',
  array['Hoy', 'Tardes', 'Noches'],
  true,
  'fast_paced',
  'Me va bien cuando hay movimiento y hay que resolver rápido.',
  'Por día o por semana',
  'Tiene motor propio.',
  'Soy rápido, respondo el teléfono y conozco bien la ciudad.',
  'Delivery, diligencias y rutas urbanas.',
  24,
  21,
  11,
  69,
  4.8,
  13
),
(
  'Rosa Méndez',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=600&q=80',
  'Santiago',
  'Santiago',
  '+18090000005',
  array['Cocina', 'Fritura', 'Ayudante de cocina'],
  2000,
  'daily',
  array['Mañanas', 'Fines de semana'],
  true,
  'hands_on',
  'Me gusta trabajar de pie, cocinar y mantener todo limpio.',
  'Por día o fijo semanal',
  'Disponible para cafeterías y comedores.',
  'Cocino con sazón, mantengo mi área limpia y llego temprano.',
  'Comedores, frituras y cocina de casa.',
  29,
  25,
  13,
  72,
  4.9,
  18
),
(
  'Carlos Alberto Díaz',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80',
  'La Altagracia',
  'Higüey',
  '+18090000006',
  array['Construcción', 'Carga', 'Ayudante'],
  2100,
  'daily',
  array['Hoy', 'Semana completa'],
  true,
  'hands_on',
  'Trabajo mejor cuando puedo moverme y ver avance.',
  '1 semana o más',
  'Puede trabajar en obra o mantenimiento.',
  'Soy fuerte, serio y no falto cuando confirmo.',
  'Obras pequeñas, carga y apoyo general.',
  22,
  19,
  8,
  62,
  4.6,
  11
),
(
  'Yudelka Jiménez',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80',
  'Distrito Nacional',
  'Santo Domingo',
  '+18090000007',
  array['Ventas', 'Promoción', 'Atención al cliente'],
  1200,
  'daily',
  array['Hoy', 'Tardes', 'Fines de semana'],
  true,
  'people_oriented',
  'Se me da fácil hablar con la gente y vender.',
  'Por día o campaña corta',
  'Disponible para activaciones y tiendas.',
  'Hablo claro, trato bien al cliente y me gusta vender.',
  'Promociones, tiendas y ventas de calle.',
  17,
  14,
  6,
  55,
  4.7,
  8
),
(
  'José Manuel Cruz',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
  'Santiago',
  'Santiago',
  '+18090000008',
  array['Delivery', 'Almacén', 'Inventario'],
  1750,
  'daily',
  array['Mañanas', 'Tardes'],
  false,
  'structured',
  'Me gusta saber la ruta y cumplirla bien.',
  'Por semana o mensual',
  'Puede iniciar mañana.',
  'Soy ordenado, cuido los paquetes y confirmo cada entrega.',
  'Almacén, rutas y apoyo de inventario.',
  20,
  17,
  9,
  64,
  4.8,
  10
),
(
  'Claudia Núñez',
  'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=600&q=80',
  'La Altagracia',
  'Higüey',
  '+18090000009',
  array['Limpieza', 'Hotel', 'Lavandería'],
  1700,
  'daily',
  array['Hoy', 'Mañanas'],
  true,
  'detail_oriented',
  'Me gusta dejar todo limpio y bien revisado.',
  'Por día o fijo semanal',
  'Disponible para villas, hoteles y casas.',
  'Soy cuidadosa con los detalles y trabajo sin perder tiempo.',
  'Limpieza de habitaciones, villas y lavandería.',
  27,
  24,
  12,
  75,
  4.9,
  15
),
(
  'Miguel Ángel Vargas',
  'https://images.unsplash.com/photo-1522556189639-b150ed9c4330?auto=format&fit=crop&w=600&q=80',
  'Distrito Nacional',
  'Santo Domingo',
  '+18090000010',
  array['Cocina', 'Parrilla', 'Ayudante'],
  2300,
  'daily',
  array['Noches', 'Fines de semana'],
  false,
  'creative',
  'Me gusta cocinar, probar sazón y sacar platos buenos.',
  'Por evento o por semana',
  'Disponible para eventos y restaurantes.',
  'Cocino con buen ritmo, soy limpio y trabajo bien bajo presión.',
  'Parrilla, eventos y cocina caliente.',
  16,
  13,
  5,
  50,
  4.6,
  7
);
