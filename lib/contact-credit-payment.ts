import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { CONTACT_CREDIT_PACKS, CONTACT_CREDIT_PURPOSE, parseContactCreditPack } from "./contact-credits";
import { getSupabaseAdminClient } from "./supabase-admin";
import { workspaceSessionPrefix } from "./employer-workspace";
import { recordEmployerReversal } from "./employer-revenue";

const headers = { "Cache-Control": "private, no-store" };
const retry = () => NextResponse.json({ error: "El pago requiere reconciliación." }, { status: 503, headers });
const received = () => NextResponse.json({ received: true }, { headers });

export async function settleContactCreditSession(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const pack = parseContactCreditPack(Number(session.metadata?.pack_size));
  const prefix = workspaceSessionPrefix();
  if (session.metadata?.purpose !== CONTACT_CREDIT_PURPOSE || !pack || !prefix ||
      !session.id.startsWith(prefix) || event.livemode !== (prefix === "cs_live_") ||
      session.mode !== "payment" || session.client_reference_id !== session.metadata.owner_user_id ||
      session.amount_total !== CONTACT_CREDIT_PACKS[pack].amount || session.currency?.toLowerCase() !== "dop") return retry();
  if (event.type === "checkout.session.completed" && session.payment_status !== "paid") return received();
  if (event.type === "checkout.session.async_payment_succeeded" && session.payment_status !== "paid") return retry();
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const state = event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed" ? "failed" : "paid";
  if (state === "paid" && !intent) return retry();
  const db = getSupabaseAdminClient();
  if (!db) return retry();
  const { data, error } = await db.rpc("settle_contact_credit_order", {
    p_order: session.metadata.order_id, p_owner: session.metadata.owner_user_id, p_session: session.id,
    p_intent: intent, p_event: event.id, p_amount: CONTACT_CREDIT_PACKS[pack].amount,
    p_currency: "dop", p_state: state,
  });
  return error || !data ? retry() : received();
}

export async function reverseContactCreditPayment(event: Stripe.Event, stripe: Stripe): Promise<NextResponse | null> {
  let charge: Stripe.Charge;
  if (event.type.startsWith("charge.dispute.")) {
    const dispute = event.data.object as Stripe.Dispute;
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (!chargeId) return retry();
    try { charge = await stripe.charges.retrieve(chargeId); } catch { return retry(); }
  } else charge = event.data.object as Stripe.Charge;
  const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!intent) return null;
  let session: Stripe.Checkout.Session;
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: intent, limit: 1 });
    if (!sessions.data[0]) return null;
    session = sessions.data[0];
  } catch { return retry(); }
  if (session.metadata?.purpose !== CONTACT_CREDIT_PURPOSE) return null;
  const db = getSupabaseAdminClient();
  if (!db) return retry();
  const pack = parseContactCreditPack(Number(session.metadata.pack_size));
  const sessionIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!pack || session.mode !== "payment" || session.payment_status !== "paid" ||
      sessionIntent !== intent ||
      session.client_reference_id !== session.metadata.owner_user_id ||
      session.amount_total !== CONTACT_CREDIT_PACKS[pack].amount || session.currency?.toLowerCase() !== "dop" ||
      !session.id.startsWith(workspaceSessionPrefix() ?? "invalid_") ||
      event.livemode !== session.id.startsWith("cs_live_")) return retry();
  if (event.type === "charge.refunded" &&
      (charge.currency?.toLowerCase() !== "dop" || charge.amount !== CONTACT_CREDIT_PACKS[pack].amount ||
       !charge.amount_refunded || charge.amount_refunded > charge.amount)) return retry();
  const { data: order, error: orderError } = await db.from("employer_contact_credit_orders")
    .select("id,amount,currency,stripe_payment_intent_id")
    .eq("id", session.metadata.order_id).eq("owner_user_id", session.metadata.owner_user_id)
    .eq("stripe_session_id", session.id).maybeSingle();
  if (orderError || !order || order.amount !== CONTACT_CREDIT_PACKS[pack].amount || order.currency !== "dop" ||
      (order.stripe_payment_intent_id && order.stripe_payment_intent_id !== intent)) return retry();
  if (!await recordEmployerReversal(db, event, "credit", order.id, order.amount)) return retry();
  const dispute = event.type.startsWith("charge.dispute.") ? event.data.object as Stripe.Dispute : null;
  if (event.type === "charge.dispute.closed" && dispute?.status !== "lost") return received();
  if (event.type === "charge.dispute.funds_reinstated" &&
      (dispute?.status !== "won" || charge.amount_refunded !== 0)) return received();
  const state = event.type === "charge.refunded" ? "refunded"
    : event.type === "charge.dispute.funds_reinstated" ? "reinstated" : "disputed";
  const { data, error } = await db.rpc("settle_contact_credit_order", {
    p_order: session.metadata.order_id, p_owner: session.metadata.owner_user_id, p_session: session.id,
    p_intent: intent, p_event: event.id, p_amount: CONTACT_CREDIT_PACKS[pack].amount,
    p_currency: "dop", p_state: state, p_event_created: event.created,
  });
  return error || !data ? retry() : received();
}
