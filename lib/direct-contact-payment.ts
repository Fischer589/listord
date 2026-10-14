import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSupabaseAdminClient } from "./supabase-admin";
import { DIRECT_CONTACT_AMOUNT_CENTS, DIRECT_CONTACT_CURRENCY, DIRECT_CONTACT_PURPOSE } from "./direct-contact";
import { workspaceSessionPrefix } from "./employer-workspace";

const headers = { "Cache-Control": "private, no-store" };
const received = (extra: Record<string, unknown> = {}) => NextResponse.json({ received: true, ...extra }, { headers });
const retry = () => NextResponse.json({ error: "El pago requiere reconciliación." }, { status: 503, headers });

function validSession(session: Stripe.Checkout.Session) {
  return session.metadata?.purpose === DIRECT_CONTACT_PURPOSE && !!session.metadata.order_id &&
    !!session.metadata.owner_user_id && !!session.metadata.worker_id &&
    session.client_reference_id === session.metadata.owner_user_id && session.mode === "payment" &&
    session.id.startsWith(workspaceSessionPrefix() ?? "invalid_session_prefix") &&
    session.amount_total === DIRECT_CONTACT_AMOUNT_CENTS && session.currency?.toLowerCase() === DIRECT_CONTACT_CURRENCY;
}

export async function recordDirectContactPayment(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  if (!validSession(session) || event.livemode !== session.id.startsWith("cs_live_")) return retry();
  const db = getSupabaseAdminClient();
  if (!db) return retry();
  const { data: order, error } = await db.from("employer_direct_contact_orders")
    .select("id,status,amount,currency,stripe_payment_intent_id")
    .eq("id", session.metadata!.order_id).eq("owner_user_id", session.metadata!.owner_user_id)
    .eq("worker_id", session.metadata!.worker_id).eq("stripe_session_id", session.id).maybeSingle();
  if (error || !order || order.amount !== DIRECT_CONTACT_AMOUNT_CENTS || order.currency !== DIRECT_CONTACT_CURRENCY) return retry();
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (order.status === "refunded" || order.status === "disputed" || order.status === "revoked") return received();
  if (order.status === "paid") return order.stripe_payment_intent_id === intent ? received({ already_processed: true }) : retry();
  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    if (order.status !== "pending") return received();
    const { error: failure } = await db.from("employer_direct_contact_orders").update({ status: "failed" })
      .eq("id", order.id).eq("status", "pending");
    return failure ? retry() : received();
  }
  if (session.payment_status !== "paid") return received();
  if (order.status !== "pending" || !intent || !Number.isSafeInteger(event.created) || event.created <= 0) return retry();
  const { data: updated, error: updateError } = await db.from("employer_direct_contact_orders")
    .update({ status: "paid", stripe_payment_intent_id: intent, stripe_paid_event_id: event.id,
      paid_at: new Date(event.created * 1000).toISOString() })
    .eq("id", order.id).eq("status", "pending").eq("stripe_session_id", session.id).select("id").maybeSingle();
  if (updateError) return retry();
  if (updated?.id) {
    try { await db.from("analytics_events").insert({ event_name: "checkout_success", metadata: { plan: "direct" } }); }
    catch { /* Measurement never determines payment fulfillment. */ }
    return received();
  }
  const latest = await db.from("employer_direct_contact_orders").select("status,stripe_payment_intent_id")
    .eq("id", order.id).maybeSingle();
  if (latest.error || latest.data?.status !== "paid" || latest.data.stripe_payment_intent_id !== intent) return retry();
  return received({ already_processed: true });
}

/** Returns null for another product's payment, preserving its refund handler. */
export async function revokeDirectContactPayment(event: Stripe.Event, stripe: Stripe): Promise<NextResponse | null> {
  let intent: string | undefined;
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  } else if (event.type === "charge.dispute.created") {
    const dispute = event.data.object as Stripe.Dispute;
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (chargeId) {
      try {
        const charge = await stripe.charges.retrieve(chargeId);
        intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      } catch { return retry(); }
    }
  }
  if (!intent) return null;
  let session: Stripe.Checkout.Session | undefined;
  try { session = (await stripe.checkout.sessions.list({ payment_intent: intent, limit: 1 })).data[0]; }
  catch { return retry(); }
  if (session?.metadata?.purpose !== DIRECT_CONTACT_PURPOSE) return null;
  const sessionIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!validSession(session) || event.livemode !== session.id.startsWith("cs_live_") || sessionIntent !== intent) return retry();
  const db = getSupabaseAdminClient();
  if (!db) return retry();
  const { data: order, error } = await db.from("employer_direct_contact_orders")
    .select("id,status,amount,currency,stripe_payment_intent_id")
    .eq("id", session.metadata!.order_id).eq("owner_user_id", session.metadata!.owner_user_id)
    .eq("worker_id", session.metadata!.worker_id).eq("stripe_session_id", session.id).maybeSingle();
  if (error || !order || order.amount !== DIRECT_CONTACT_AMOUNT_CENTS || order.currency !== DIRECT_CONTACT_CURRENCY ||
      (order.stripe_payment_intent_id && order.stripe_payment_intent_id !== intent)) return retry();
  if (order.status === "refunded" || order.status === "disputed" || order.status === "revoked") return received({ already_processed: true });
  const status = event.type === "charge.refunded" ? "refunded" : "disputed";
  const { data: updated, error: updateError } = await db.from("employer_direct_contact_orders")
    .update({ status, stripe_payment_intent_id: intent, stripe_reversal_event_id: event.id })
    .eq("id", order.id).eq("status", order.status).select("id").maybeSingle();
  return updateError || !updated?.id ? retry() : received();
}
