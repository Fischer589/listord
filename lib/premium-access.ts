import { getSupabaseAdminClient } from "./supabase-admin";

export type PremiumPlan = "weekly" | "monthly";

export type PremiumAccessRecord = {
  browser_session_id: string | null;
  stripe_checkout_session_id: string;
  stripe_customer_id: string | null;
  plan: PremiumPlan;
  paid_access_until: string;
};

export function getPaidAccessUntil(plan: PremiumPlan, now = new Date()) {
  const days = plan === "weekly" ? 7 : 30;
  const paidAccessUntil = new Date(now);
  paidAccessUntil.setDate(paidAccessUntil.getDate() + days);

  return paidAccessUntil;
}

export async function upsertPremiumAccess(record: PremiumAccessRecord) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const { error } = await supabase
    .from("premium_access")
    .upsert(record, { onConflict: "stripe_checkout_session_id" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getActivePremiumAccess(browserSessionId: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const { data, error } = await supabase
    .from("premium_access")
    .select("plan, paid_access_until")
    .eq("browser_session_id", browserSessionId)
    .gt("paid_access_until", new Date().toISOString())
    .order("paid_access_until", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getPremiumAccessByCheckoutSession(
  stripeCheckoutSessionId: string,
  browserSessionId?: string
) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  let query = supabase
    .from("premium_access")
    .select("plan, paid_access_until, browser_session_id")
    .eq("stripe_checkout_session_id", stripeCheckoutSessionId)
    .gt("paid_access_until", new Date().toISOString());

  if (browserSessionId) {
    query = query.eq("browser_session_id", browserSessionId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
