import { getSupabaseAdminClient } from "./supabase-admin";
import { isValidEditToken } from "./worker-profile";
import { getBoostEligibility, type BoostState } from "./boost";

export type BoostableWorker = {
  id: string;
  edit_token: string;
  full_name: string;
  city: string;
  skills: string[] | null;
  is_verified: boolean;
  last_boosted_at: string | null;
  boost_expires_at: string | null;
  consecutive_boost_count: number;
  boost_cooldown_until: string | null;
};

/**
 * Resolves the worker a boost purchase applies to. Uses the SAME ownership
 * mechanism as profile editing (edit_token) — never trust a raw worker_id
 * from the client alone.
 */
export async function findBoostableWorkerByEditToken(
  editToken: string
): Promise<BoostableWorker | null> {
  const trimmedToken = editToken?.trim() || "";

  if (!trimmedToken || !isValidEditToken(trimmedToken)) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("workers")
    .select(
      `
      id,
      edit_token,
      full_name,
      city,
      skills,
      is_verified,
      last_boosted_at,
      boost_expires_at,
      consecutive_boost_count,
      boost_cooldown_until
    `
    )
    .eq("edit_token", trimmedToken)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn("Boost worker lookup failed.", { code: error.code });
    }
    return null;
  }

  return data as BoostableWorker;
}

export function toBoostState(worker: BoostableWorker): BoostState {
  return {
    lastBoostedAt: worker.last_boosted_at,
    boostExpiresAt: worker.boost_expires_at,
    consecutiveBoostCount: worker.consecutive_boost_count ?? 0,
    cooldownUntil: worker.boost_cooldown_until
  };
}

export function checkBoostEligibility(worker: BoostableWorker, now = new Date()) {
  return getBoostEligibility(toBoostState(worker), now);
}

/** Pre-creates a 'pending' purchase record — used for idempotent activation later. */
export async function recordBoostCheckoutStarted(params: {
  workerId: string;
  stripeCheckoutSessionId: string;
  amount: number;
  currency: string;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client unavailable.");
  }

  const { error } = await supabase.from("worker_boosts").insert({
    worker_id: params.workerId,
    stripe_checkout_session_id: params.stripeCheckoutSessionId,
    payment_status: "pending",
    amount: params.amount,
    currency: params.currency
  });

  if (error) {
    console.warn("Boost purchase record insert failed.", { code: error.code });
  }
}

export type ActivateBoostResult = {
  activated: boolean;
  already_processed: boolean;
  boost_expires_at: string | null;
  consecutive_boost_count: number;
  cooldown_until: string | null;
};

/** Calls the atomic Postgres RPC that performs activation + idempotency together. */
export async function activateWorkerBoost(params: {
  workerId: string;
  stripeCheckoutSessionId: string;
  amount: number;
  currency: string;
}): Promise<ActivateBoostResult | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .rpc("activate_worker_boost", {
      p_worker_id: params.workerId,
      p_stripe_checkout_session_id: params.stripeCheckoutSessionId,
      p_amount: params.amount,
      p_currency: params.currency
    })
    .maybeSingle();

  if (error) {
    console.error("activate_worker_boost RPC failed.", {
      code: error.code,
      message: error.message
    });
    return null;
  }

  return data as ActivateBoostResult | null;
}

export async function getBoostBySessionId(sessionId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("worker_boosts")
    .select("payment_status, boost_expires_at, worker_id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.warn("Boost session lookup failed.", { code: error.code });
    return null;
  }

  return data;
}
