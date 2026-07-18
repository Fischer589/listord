-- Phase: Worker Profile Boost (paid visibility)
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE / DROP...IF EXISTS.

-- ─── 1. Boost state on the workers table ────────────────────────────────
-- These columns hold the CURRENT boost state only. Full purchase history
-- lives in public.worker_boosts (see below) — never overwritten.
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS last_boosted_at timestamptz,
  ADD COLUMN IF NOT EXISTS boost_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_boost_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boost_cooldown_until timestamptz;

COMMENT ON COLUMN public.workers.last_boosted_at IS 'Timestamp of the most recent successful boost payment.';
COMMENT ON COLUMN public.workers.boost_expires_at IS 'Boost priority is active while this is in the future.';
COMMENT ON COLUMN public.workers.consecutive_boost_count IS 'Number of consecutive daily boosts purchased (resets after a cooldown or a gap > 48h).';
COMMENT ON COLUMN public.workers.boost_cooldown_until IS 'Set after the 5th consecutive boost; blocks new boost purchases until this passes.';

-- Directory ranking reads active boosts most often — index the hot path.
CREATE INDEX IF NOT EXISTS idx_workers_boost_active
  ON public.workers (boost_expires_at DESC)
  WHERE is_verified = TRUE;

-- ─── 2. Boost purchase history — one row per Stripe checkout session ─────
CREATE TABLE IF NOT EXISTS public.worker_boosts (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
  amount integer not null,
  currency text not null default 'dop',
  boost_started_at timestamptz,
  boost_expires_at timestamptz,
  consecutive_boost_day integer,
  cooldown_until timestamptz,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_worker_boosts_worker_created
  ON public.worker_boosts (worker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_boosts_status
  ON public.worker_boosts (payment_status);

ALTER TABLE public.worker_boosts ENABLE ROW LEVEL SECURITY;
-- Intentionally no public policies — worker_boosts is only ever read/written
-- via the service-role admin client (checkout route, webhook, admin dashboard).
-- This matches Feature 9: boost analytics must never be public.

-- ─── 3. Atomic activation RPC — mirrors the existing claim_worker_contact
--        pattern (security definer, row lock, idempotent on conflict). ────
CREATE OR REPLACE FUNCTION public.activate_worker_boost(
  p_worker_id uuid,
  p_stripe_checkout_session_id text,
  p_amount integer,
  p_currency text
)
RETURNS TABLE (
  activated boolean,
  already_processed boolean,
  boost_expires_at timestamptz,
  consecutive_boost_count integer,
  cooldown_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_last_boosted_at timestamptz;
  v_cooldown_until timestamptz;
  v_consecutive integer;
  v_existing_status text;
  v_existing_expires timestamptz;
  v_existing_count integer;
  v_existing_cooldown timestamptz;
  v_new_count integer;
  v_new_expires timestamptz;
  v_new_cooldown timestamptz;
BEGIN
  -- Idempotency guard: this exact Stripe checkout session was already
  -- processed to completion — return the previously computed result
  -- instead of activating (or mutating anything) a second time.
  SELECT payment_status, boost_expires_at, consecutive_boost_day, cooldown_until
  INTO v_existing_status, v_existing_expires, v_existing_count, v_existing_cooldown
  FROM public.worker_boosts
  WHERE stripe_checkout_session_id = p_stripe_checkout_session_id;

  IF v_existing_status = 'paid' THEN
    RETURN QUERY SELECT false, true, v_existing_expires, v_existing_count, v_existing_cooldown;
    RETURN;
  END IF;

  SELECT last_boosted_at, boost_cooldown_until, consecutive_boost_count
  INTO v_last_boosted_at, v_cooldown_until, v_consecutive
  FROM public.workers
  WHERE id = p_worker_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::timestamptz, 0, NULL::timestamptz;
    RETURN;
  END IF;

  -- Consecutive chain: resets to 1 if a cooldown fully elapsed, or if the
  -- gap since the last boost exceeds the 48h grace window; otherwise +1
  -- (capped at 5).
  IF v_cooldown_until IS NOT NULL AND v_now < v_cooldown_until THEN
    v_new_count := 1; -- defensive — checkout creation already blocks this case
  ELSIF v_cooldown_until IS NOT NULL AND v_now >= v_cooldown_until THEN
    v_new_count := 1;
  ELSIF v_last_boosted_at IS NOT NULL AND (v_now - v_last_boosted_at) <= interval '48 hours' THEN
    v_new_count := LEAST(COALESCE(v_consecutive, 0) + 1, 5);
  ELSE
    v_new_count := 1;
  END IF;

  v_new_expires := v_now + interval '24 hours';

  IF v_new_count >= 5 THEN
    v_new_cooldown := v_new_expires + interval '7 days';
  ELSE
    v_new_cooldown := NULL;
  END IF;

  UPDATE public.workers
  SET
    last_boosted_at = v_now,
    boost_expires_at = v_new_expires,
    consecutive_boost_count = v_new_count,
    boost_cooldown_until = v_new_cooldown
  WHERE id = p_worker_id;

  INSERT INTO public.worker_boosts (
    worker_id, stripe_checkout_session_id, payment_status, amount, currency,
    boost_started_at, boost_expires_at, consecutive_boost_day, cooldown_until
  ) VALUES (
    p_worker_id, p_stripe_checkout_session_id, 'paid', p_amount, p_currency,
    v_now, v_new_expires, v_new_count, v_new_cooldown
  )
  ON CONFLICT (stripe_checkout_session_id) DO UPDATE
  SET
    payment_status = 'paid',
    boost_started_at = v_now,
    boost_expires_at = v_new_expires,
    consecutive_boost_day = v_new_count,
    cooldown_until = v_new_cooldown;

  RETURN QUERY SELECT true, false, v_new_expires, v_new_count, v_new_cooldown;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_worker_boost(uuid, text, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.activate_worker_boost(uuid, text, integer, text) TO service_role;

-- ─── 4. Extend analytics_events to allow boost lifecycle events ─────────
-- (Admin-only — these events are never surfaced on public pages/cards.)
ALTER TABLE public.analytics_events DROP CONSTRAINT IF EXISTS analytics_events_event_name_check;
ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_event_name_check
CHECK (
  event_name in (
    'page_view',
    'worker_view',
    'contact_click',
    'paywall_open',
    'checkout_start',
    'checkout_success',
    'boost_purchase_started',
    'boost_payment_success',
    'boost_activated',
    'boost_expired',
    'boosted_profile_view',
    'boost_contact_initiated'
  )
);
