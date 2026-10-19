import type Stripe from "stripe";
import type { getSupabaseAdminClient } from "./supabase-admin";

/** Signed Stripe events only. Each cumulative reversal snapshot is immutable. */
export async function recordEmployerReversal(
  db: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  event: Stripe.Event,
  product: "direct" | "workspace",
  orderId: string,
  orderAmount: number
) {
  const cumulative = event.type === "charge.refunded"
    ? (event.data.object as Stripe.Charge).amount_refunded
    : event.type === "charge.dispute.created" ? (event.data.object as Stripe.Dispute).amount : null;
  if (!event.id || !Number.isSafeInteger(event.created) || event.created <= 0 ||
      !Number.isSafeInteger(cumulative) || !cumulative || cumulative <= 0 || cumulative > orderAmount) return false;
  const { error } = await db.from("employer_payment_reversals").upsert({
    stripe_event_id: event.id, order_id: orderId, product,
    kind: event.type === "charge.refunded" ? "refund" : "dispute",
    cumulative_amount_cents: cumulative, occurred_at: new Date(event.created * 1000).toISOString()
  }, { onConflict: "stripe_event_id", ignoreDuplicates: true });
  return !error;
}
