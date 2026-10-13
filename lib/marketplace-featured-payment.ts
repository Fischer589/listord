import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSupabaseAdminClient } from "./supabase-admin";
import { FEATURED_AMOUNT_CENTS, FEATURED_CURRENCY, FEATURED_PURPOSE, featuredReadEnabled } from "./marketplace-featured";

const headers = { "Cache-Control": "private, no-store" };
const received = (extra: Record<string, unknown> = {}) => NextResponse.json({ received: true, ...extra }, { headers });
const retry = () => NextResponse.json({ error: "El pago requiere reconciliación." }, { status: 503, headers });

function validSession(session: Stripe.Checkout.Session) {
  return session.metadata?.purpose === FEATURED_PURPOSE && !!session.metadata.order_id &&
    !!session.metadata.owner_user_id && !!session.metadata.opportunity_id &&
    session.client_reference_id === session.metadata.owner_user_id && session.mode === "payment" &&
    session.amount_total === FEATURED_AMOUNT_CENTS && session.currency?.toLowerCase() === FEATURED_CURRENCY;
}

export async function recordFeaturedPayment(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  if (!validSession(session)) return retry();
  const db = getSupabaseAdminClient();
  if (!db) return retry();
  const { data: order, error } = await db.from("marketplace_featured_orders")
    .select("id,owner_user_id,opportunity_id,stripe_session_id,amount,currency,status,stripe_payment_intent_id")
    .eq("id", session.metadata!.order_id).eq("owner_user_id", session.metadata!.owner_user_id)
    .eq("opportunity_id", session.metadata!.opportunity_id).eq("stripe_session_id", session.id).maybeSingle();
  if (error || !order || order.amount !== FEATURED_AMOUNT_CENTS || order.currency !== FEATURED_CURRENCY) return retry();
  if (order.status === "refunded") return received();
  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const { error: failure } = await db.rpc("marketplace_featured_fail", { p_order: order.id, p_session: session.id });
    return failure ? retry() : received();
  }
  if (session.payment_status !== "paid") return received();
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!intent || !Number.isSafeInteger(event.created) || event.created <= 0) return retry();
  const { data: result, error: paymentError } = await db.rpc("marketplace_featured_paid", {
    p_order: order.id, p_session: session.id, p_intent: intent, p_event: event.id,
    p_paid_at: new Date(event.created * 1000).toISOString()
  });
  return paymentError ? retry() : received(result === "already_paid" ? { already_processed: true } : {});
}

/** Returns null when the charge belongs to another existing payment product. */
export async function revokeFeaturedPayment(event: Stripe.Event, stripe: Stripe): Promise<NextResponse | null> {
  if (!featuredReadEnabled()) return null;
  const charge = event.data.object as Stripe.Charge;
  const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!intent) return null;
  const db = getSupabaseAdminClient();
  if (!db) return retry();
  const { data: bound, error } = await db.from("marketplace_featured_orders")
    .select("id,stripe_session_id").eq("stripe_payment_intent_id", intent).maybeSingle();
  if (error) return retry();
  let session: Stripe.Checkout.Session | undefined;
  try {
    if (bound?.stripe_session_id) session = await stripe.checkout.sessions.retrieve(bound.stripe_session_id);
    else session = (await stripe.checkout.sessions.list({ payment_intent: intent, limit: 1 })).data[0];
  } catch { return bound ? retry() : null; }
  if (!session || session.metadata?.purpose !== FEATURED_PURPOSE) return bound ? retry() : null;
  const sessionIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!validSession(session) || sessionIntent !== intent || (bound && bound.id !== session.metadata?.order_id)) return retry();
  const { data: order, error: orderError } = await db.from("marketplace_featured_orders")
    .select("id").eq("id", session.metadata!.order_id).eq("owner_user_id", session.metadata!.owner_user_id)
    .eq("opportunity_id", session.metadata!.opportunity_id).eq("stripe_session_id", session.id).maybeSingle();
  if (orderError || !order) return retry();
  const { error: refundError } = await db.rpc("marketplace_featured_refund", {
    p_order: order.id, p_session: session.id, p_intent: intent, p_event: event.id
  });
  return refundError ? retry() : received();
}
