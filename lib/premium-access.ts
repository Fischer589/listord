import { getSupabaseAdminClient } from "./supabase-admin";
import { normalizeWhatsAppNumber } from "./whatsapp";

export type PremiumPlan = "weekly" | "monthly";

export type PremiumAccessRecord = {
  browser_session_id: string | null;
  whatsapp_number: string | null;
  stripe_checkout_session_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: PremiumPlan;
  status: "active";
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

  const normalizedRecord = {
    ...record,
    browser_session_id: record.browser_session_id?.trim() || null,
    whatsapp_number: normalizeWhatsAppNumber(record.whatsapp_number)
  };

  const { error } = await supabase
    .from("premium_access")
    .upsert(normalizedRecord, { onConflict: "stripe_checkout_session_id" });

  if (error) {
    throw new Error(error.message);
  }
}

type PremiumLookup = {
  browserSessionId?: string | null;
  whatsappNumber?: string | null;
};

function normalizePremiumLookup({
  browserSessionId,
  whatsappNumber
}: PremiumLookup) {
  return {
    browserSessionId: browserSessionId?.trim() || null,
    whatsappNumber: normalizeWhatsAppNumber(whatsappNumber)
  };
}

export async function getActivePremiumAccess(lookup: PremiumLookup) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const { browserSessionId, whatsappNumber } = normalizePremiumLookup(lookup);

  if (!browserSessionId && !whatsappNumber) {
    return null;
  }

  if (browserSessionId) {
    const { data, error } = await supabase
      .from("premium_access")
      .select("plan, paid_access_until, browser_session_id, whatsapp_number")
      .eq("browser_session_id", browserSessionId)
      .eq("status", "active")
      .gt("paid_access_until", new Date().toISOString())
      .order("paid_access_until", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data;
    }
  }

  if (!whatsappNumber) {
    return null;
  }

  const { data, error } = await supabase
    .from("premium_access")
    .select("plan, paid_access_until, browser_session_id, whatsapp_number")
    .eq("whatsapp_number", whatsappNumber)
    .eq("status", "active")
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
    .select("plan, paid_access_until, browser_session_id, whatsapp_number")
    .eq("stripe_checkout_session_id", stripeCheckoutSessionId)
    .eq("status", "active")
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
