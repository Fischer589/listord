import type Stripe from "stripe";
import { marketplaceEnabled, uuid } from "./marketplace";

export const EXPRESS_AMOUNT = 29900;
export const EXPRESS_CURRENCY = "dop";
export const EXPRESS_TERMS = "express-v1-draft";
export const EXPRESS_DESCRIPTION = "RD$299, pago único. Invitaciones a perfiles compatibles que aceptaron recibirlas; no garantiza contratación. Plazo propuesto: 24 horas desde el pago. Sin respuesta SÍ en ese plazo: reembolso total. Términos pendientes de aprobación.";
/** No defaults for external readiness. These attestations require hosted acceptance,
 * not merely credentials. No code in this repository sets them automatically. */
export function expressEnabled() {
  return marketplaceEnabled() && process.env.EXPRESS_ENABLED === "true"
    && process.env.EXPRESS_ACCEPTED_TERMS === EXPRESS_TERMS
    && process.env.EXPRESS_SETTLEMENT_VERIFIED === "dop"
    && process.env.EXPRESS_OUTREACH_ACCEPTED === "true";
}
export type ExpressOrder = { id: string; opportunity_id: string; channel: "stripe" | "transfer"; status: string; created_at: string; checkout_session_id: string | null; reference: string };
export function checkoutParameters(order: ExpressOrder, origin: string, now = Date.now()): Stripe.Checkout.SessionCreateParams {
  const base = new URL(origin);
  const created = Date.parse(order.created_at);
  if (!uuid(order.id) || order.channel !== "stripe" || order.status !== "payment_pending" || !Number.isFinite(created) || now < created || now - created > 30 * 60000 || base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) throw new Error("CHECKOUT_UNAVAILABLE");
  return {
    mode: "payment", payment_method_types: ["card"], client_reference_id: order.id,
    metadata: { purpose: "listord_express", order_id: order.id },
    payment_intent_data: { metadata: { purpose: "listord_express", order_id: order.id } },
    line_items: [{ price_data: { currency: EXPRESS_CURRENCY, unit_amount: EXPRESS_AMOUNT, product_data: { name: "ListoRD Express", description: EXPRESS_DESCRIPTION } }, quantity: 1 }],
    // Stable parameters on retries; deadline still >=30 minutes for allowed calls.
    expires_at: Math.floor(created / 1000) + 7200,
    success_url: `${base.origin}/oportunidades?express=pendiente`, cancel_url: `${base.origin}/oportunidades`,
    locale: "es", adaptive_pricing: { enabled: false }
  };
}
export function verifiedExpressPayment(event: Stripe.Event) {
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return null;
  const s = event.data.object as Stripe.Checkout.Session;
  if (s.metadata?.purpose !== "listord_express") return null;
  if (!uuid(s.metadata.order_id) || s.client_reference_id !== s.metadata.order_id || s.mode !== "payment" || s.payment_status !== "paid" || s.amount_total !== EXPRESS_AMOUNT || s.currency !== EXPRESS_CURRENCY || typeof s.payment_intent !== "string" || !s.payment_intent.startsWith("pi_")) throw new Error("INVALID_EXPRESS_PAYMENT");
  return { order: s.metadata.order_id, session: s.id, reference: s.payment_intent, event: event.id };
}

export type Invitation = { worker_id: string; phone: string; opportunity_id: string };
export type DispatchStore = { claim: () => Promise<Invitation | null>; record: (worker: string, receipt: string) => Promise<void> };
/** Claim is committed before any provider call. Uncertain sends stay claimed and
 * are never automatically retried. A response is recorded only by marketplace_decide. */
export async function dispatchOne(store: DispatchStore, send: (invitation: Invitation) => Promise<string>) {
  const invitation = await store.claim();
  if (!invitation) return { sent: false };
  const receipt = await send(invitation);
  if (!receipt || receipt.length > 200) throw new Error("DELIVERY_UNCONFIRMED");
  await store.record(invitation.worker_id, receipt);
  return { sent: true };
}
