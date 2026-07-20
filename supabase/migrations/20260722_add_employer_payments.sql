-- Phase: Employer Deposit (standalone Stripe payment, tracked separately
-- from employer_requests and worker_boosts).
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE / DROP...IF EXISTS.

CREATE TABLE IF NOT EXISTS public.employer_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stripe_payment_id text,
  stripe_session_id text not null unique,
  amount integer not null,
  currency text not null default 'dop',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  customer_name text,
  customer_email text,
  customer_phone text,
  paid_at timestamptz
);

COMMENT ON TABLE public.employer_payments IS 'Employer service deposit payments (RD$3,000 Stripe Checkout) — reviewed by admins only.';
COMMENT ON COLUMN public.employer_payments.stripe_session_id IS 'Stripe Checkout Session id — unique, used for idempotent webhook updates.';
COMMENT ON COLUMN public.employer_payments.stripe_payment_id IS 'Stripe PaymentIntent id, set once the webhook confirms payment.';

CREATE INDEX IF NOT EXISTS idx_employer_payments_status_created
  ON public.employer_payments (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employer_payments_created
  ON public.employer_payments (created_at DESC);

ALTER TABLE public.employer_payments ENABLE ROW LEVEL SECURITY;
-- Intentionally no public policies — employer_payments contains contact info
-- and payment data, only ever read/written via the service-role admin client
-- (deposit checkout route, webhook, admin dashboard). Same privacy posture
-- as worker_boosts / employer_requests.
