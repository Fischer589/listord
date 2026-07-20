-- Phase: Employer Request System (demand side)
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE / DROP...IF EXISTS.

CREATE TABLE IF NOT EXISTS public.employer_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  client_type text not null,
  service_needed text not null,
  category_source text not null default 'catalog' check (category_source in ('catalog', 'otro')),
  location text not null,
  description text not null,
  employment_type text not null,
  budget text,
  whatsapp text not null,
  email text,
  status text not null default 'new' check (status in ('new', 'contacted', 'matching', 'completed'))
);

COMMENT ON TABLE public.employer_requests IS 'Employer/business requests for workers — the demand side of ListoRD. Reviewed and actioned by admins only.';
COMMENT ON COLUMN public.employer_requests.service_needed IS 'Worker category requested. When category_source = catalog, this exactly matches a lib/categories.ts searchKey so it can be matched against worker skills. When category_source = otro, this is free text.';
COMMENT ON COLUMN public.employer_requests.category_source IS 'catalog = selected from the existing worker category list (matchable); otro = free text typed by the employer (not yet matchable).';

CREATE INDEX IF NOT EXISTS idx_employer_requests_status_created
  ON public.employer_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employer_requests_service_needed
  ON public.employer_requests (service_needed);

CREATE INDEX IF NOT EXISTS idx_employer_requests_created
  ON public.employer_requests (created_at DESC);

ALTER TABLE public.employer_requests ENABLE ROW LEVEL SECURITY;
-- Intentionally no public policies — employer_requests contains contact info
-- (WhatsApp, email) and is only ever read/written via the service-role admin
-- client (form submission server action + admin dashboard). Same privacy
-- posture as worker_boosts.
