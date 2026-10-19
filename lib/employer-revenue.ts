import type Stripe from "stripe";
import type { getSupabaseAdminClient } from "./supabase-admin";

/** Signed Stripe events only. Each refund snapshot or dispute state is immutable. */
export async function recordEmployerReversal(
  db: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  event: Stripe.Event,
  product: "direct" | "workspace" | "credit",
  orderId: string,
  orderAmount: number
) {
  const dispute = event.type.startsWith("charge.dispute.") ? event.data.object as Stripe.Dispute : null;
  const kind = event.type === "charge.refunded" ? "refund"
    : event.type === "charge.dispute.created" || event.type === "charge.dispute.funds_withdrawn" ? "dispute_opened"
    : event.type === "charge.dispute.funds_reinstated" ||
      (event.type === "charge.dispute.closed" && dispute?.status === "warning_closed") ? "dispute_released"
    : event.type === "charge.dispute.closed" && dispute?.status === "won" ? "dispute_won"
    : event.type === "charge.dispute.closed" && dispute?.status === "lost" ? "dispute_lost" : null;
  const cumulative = event.type === "charge.refunded"
    ? (event.data.object as Stripe.Charge).amount_refunded : dispute?.amount;
  if (!event.id || !Number.isSafeInteger(event.created) || event.created <= 0 ||
      !kind || !Number.isSafeInteger(cumulative) || !cumulative || cumulative <= 0 || cumulative > orderAmount ||
      (dispute && !dispute.id)) return false;
  const { error } = await db.from("employer_payment_reversals").upsert({
    stripe_event_id: event.id, order_id: orderId, product,
    kind, dispute_id: dispute?.id ?? null,
    cumulative_amount_cents: cumulative, occurred_at: new Date(event.created * 1000).toISOString()
  }, { onConflict: "stripe_event_id", ignoreDuplicates: true });
  return !error;
}
