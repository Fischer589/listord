import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSupabaseAdminClient } from "./supabase-admin";
import { WORKSPACE_AMOUNT_CENTS, WORKSPACE_CURRENCY, WORKSPACE_PURPOSE, workspaceAccessUntil } from "./employer-workspace";

const headers = { "Cache-Control": "private, no-store" };
const retry = () => NextResponse.json({ error: "El pago requiere reconciliación." }, { status: 503, headers });

export async function recordWorkspacePayment(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.order_id;
  const ownerId = session.metadata?.owner_user_id;
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (session.metadata?.purpose !== WORKSPACE_PURPOSE || !orderId || !ownerId ||
      session.client_reference_id !== ownerId || !session.id || session.mode !== "payment") return retry();
  const db = getSupabaseAdminClient();
  if (!db) return retry();
  const { data: order, error } = await db.from("employer_workspace_orders")
    .select("id,owner_user_id,status,amount,currency,stripe_session_id,stripe_payment_intent_id")
    .eq("id", orderId).eq("owner_user_id", ownerId).eq("stripe_session_id", session.id).maybeSingle();
  if (error || !order || order.amount !== WORKSPACE_AMOUNT_CENTS || order.currency !== WORKSPACE_CURRENCY) return retry();
  if (order.status === "paid") return NextResponse.json({ received: true, already_processed: true }, { headers });
  if (order.status === "refunded") return NextResponse.json({ received: true }, { headers });

  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const { error: failureError } = await db.from("employer_workspace_orders")
      .update({ status: "failed" }).eq("id", orderId).eq("status", "pending");
    return failureError ? retry() : NextResponse.json({ received: true }, { headers });
  }
  if (session.payment_status !== "paid") return NextResponse.json({ received: true }, { headers });
  if (session.amount_total !== WORKSPACE_AMOUNT_CENTS || session.currency?.toLowerCase() !== WORKSPACE_CURRENCY || !paymentIntent) return retry();
  if (!Number.isSafeInteger(event.created) || event.created <= 0) return retry();
  const paidAt = new Date(event.created * 1000);
  const { data: updated, error: updateError } = await db.from("employer_workspace_orders")
    .update({ status: "paid", stripe_payment_intent_id: paymentIntent,
      paid_at: paidAt.toISOString(), access_until: workspaceAccessUntil(paidAt) })
    .eq("id", orderId).eq("status", order.status).eq("stripe_session_id", session.id)
    .select("id").maybeSingle();
  if (updateError) return retry();
  if (updated?.id) return NextResponse.json({ received: true }, { headers });
  const { data: latest, error: latestError } = await db.from("employer_workspace_orders")
    .select("status,stripe_payment_intent_id").eq("id", orderId).maybeSingle();
  if (latestError || latest?.status !== "paid" || latest.stripe_payment_intent_id !== paymentIntent) return retry();
  return NextResponse.json({ received: true, already_processed: true }, { headers });
}

export async function revokeWorkspacePayment(event: Stripe.Event, stripe: Stripe) {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return NextResponse.json({ received: true }, { headers });
  const db = getSupabaseAdminClient();
  if (!db) return retry();
  const { data: paidOrder, error: paidError } = await db.from("employer_workspace_orders")
    .update({ status: "refunded", access_until: null }).eq("stripe_payment_intent_id", paymentIntent)
    .eq("status", "paid").select("id").maybeSingle();
  if (paidError) return retry();
  if (paidOrder?.id) return NextResponse.json({ received: true }, { headers });

  // Stripe does not guarantee event ordering. Resolve the Checkout Session
  // when a refund arrives before the paid event bound its PaymentIntent.
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
    const session = sessions.data[0];
    if (!session) return retry();
    if (session.metadata?.purpose !== WORKSPACE_PURPOSE) return NextResponse.json({ received: true }, { headers });
    const orderId = session.metadata.order_id;
    const ownerId = session.metadata.owner_user_id;
    if (!orderId || !ownerId || session.client_reference_id !== ownerId ||
        session.mode !== "payment" || session.amount_total !== WORKSPACE_AMOUNT_CENTS ||
        session.currency?.toLowerCase() !== WORKSPACE_CURRENCY) return retry();
    const { data: order, error: orderError } = await db.from("employer_workspace_orders")
      .select("id,status").eq("id", orderId).eq("owner_user_id", ownerId)
      .eq("stripe_session_id", session.id).maybeSingle();
    if (orderError || !order) return retry();
    if (order.status === "refunded") return NextResponse.json({ received: true }, { headers });
    const { data: updated, error: updateError } = await db.from("employer_workspace_orders")
      .update({ status: "refunded", stripe_payment_intent_id: paymentIntent, access_until: null })
      .eq("id", orderId).eq("status", order.status).select("id").maybeSingle();
    if (updateError || !updated?.id) return retry();
    return NextResponse.json({ received: true }, { headers });
  } catch { return retry(); }
}
