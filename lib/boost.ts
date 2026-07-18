/**
 * Worker profile boost — pure ranking/eligibility logic.
 *
 * Kept dependency-free (no Supabase/Stripe imports) so it can be unit
 * tested in isolation and reused by both the checkout route (pre-purchase
 * eligibility check) and the webhook (post-payment activation).
 */

export const BOOST_AMOUNT_CENTS = 10_000; // RD$100.00 in centavos
export const BOOST_CURRENCY = "dop";

const HOUR_MS = 60 * 60 * 1000;
export const BOOST_DURATION_MS = 24 * HOUR_MS;
export const BOOST_MIN_INTERVAL_MS = 24 * HOUR_MS;
/** Max gap between boosts that still counts as an unbroken consecutive chain. */
export const BOOST_CHAIN_GRACE_MS = 48 * HOUR_MS;
export const BOOST_MAX_CONSECUTIVE = 5;
export const BOOST_COOLDOWN_MS = 7 * 24 * HOUR_MS;

export type BoostState = {
  lastBoostedAt: string | null;
  boostExpiresAt: string | null;
  consecutiveBoostCount: number;
  cooldownUntil: string | null;
};

export type BoostEligibility =
  | { allowed: true }
  | { allowed: false; reason: "cooldown"; cooldownUntil: string }
  | { allowed: false; reason: "too_soon"; nextEligibleAt: string };

export type BoostActivation = {
  lastBoostedAt: string;
  boostStartedAt: string;
  boostExpiresAt: string;
  consecutiveBoostCount: number;
  cooldownUntil: string | null;
};

/** True while a worker's boost is currently in its 24h priority window. */
export function isBoostActive(
  state: Pick<BoostState, "boostExpiresAt">,
  now: Date = new Date()
): boolean {
  if (!state.boostExpiresAt) return false;
  return new Date(state.boostExpiresAt).getTime() > now.getTime();
}

/**
 * Server-side gate — must be checked before creating a Stripe Checkout
 * session AND re-checked at webhook time. Never rely on the client.
 */
export function getBoostEligibility(
  state: BoostState,
  now: Date = new Date()
): BoostEligibility {
  const nowMs = now.getTime();

  if (state.cooldownUntil) {
    const cooldownMs = new Date(state.cooldownUntil).getTime();
    if (nowMs < cooldownMs) {
      return { allowed: false, reason: "cooldown", cooldownUntil: state.cooldownUntil };
    }
  }

  if (state.lastBoostedAt) {
    const lastMs = new Date(state.lastBoostedAt).getTime();
    const nextEligibleMs = lastMs + BOOST_MIN_INTERVAL_MS;
    if (nowMs < nextEligibleMs) {
      return {
        allowed: false,
        reason: "too_soon",
        nextEligibleAt: new Date(nextEligibleMs).toISOString()
      };
    }
  }

  return { allowed: true };
}

/**
 * Computes the next boost state after a verified successful payment.
 * Pure function — the caller (webhook) is responsible for persisting the
 * result and for idempotency (never call this twice for the same payment).
 */
export function computeBoostActivation(
  state: BoostState,
  now: Date = new Date()
): BoostActivation {
  const nowMs = now.getTime();

  // A cooldown that has fully elapsed always resets the consecutive chain,
  // regardless of how recently the worker's last boost technically expired.
  const cooldownElapsed =
    !state.cooldownUntil || nowMs >= new Date(state.cooldownUntil).getTime();

  const previousCount = cooldownElapsed ? state.consecutiveBoostCount || 0 : 0;

  const withinChain =
    cooldownElapsed &&
    state.lastBoostedAt != null &&
    nowMs - new Date(state.lastBoostedAt).getTime() <= BOOST_CHAIN_GRACE_MS;

  const nextCount = withinChain
    ? Math.min(previousCount + 1, BOOST_MAX_CONSECUTIVE)
    : 1;

  const boostStartedAt = now;
  const boostExpiresAt = new Date(nowMs + BOOST_DURATION_MS);

  const cooldownUntil =
    nextCount >= BOOST_MAX_CONSECUTIVE
      ? new Date(boostExpiresAt.getTime() + BOOST_COOLDOWN_MS).toISOString()
      : null;

  return {
    lastBoostedAt: boostStartedAt.toISOString(),
    boostStartedAt: boostStartedAt.toISOString(),
    boostExpiresAt: boostExpiresAt.toISOString(),
    consecutiveBoostCount: nextCount,
    cooldownUntil
  };
}

export function getBoostRejectionMessage(eligibility: BoostEligibility): string {
  if (eligibility.allowed) return "";

  if (eligibility.reason === "cooldown") {
    return "Has alcanzado el límite de impulsos consecutivos. Podrás volver a impulsar tu perfil después del período de espera.";
  }

  return "Ya impulsaste tu perfil recientemente. Podrás volver a impulsarlo cuando pasen 24 horas desde tu último impulso.";
}
