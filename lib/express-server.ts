import Stripe from "stripe";
import { verifiedExpressPayment } from "./express";
import { marketplaceAdmin, rpcFailure } from "./marketplace-server";

/** Signature verification happens in the existing webhook before this handler.
 * It remains available when sales are disabled, for paid-order reconciliation. */
export async function recordExpressPayment(event: Stripe.Event) {
  const p = verifiedExpressPayment(event);
  if (!p) return;
  const admin = marketplaceAdmin();
  const { data: order, error: readError } = await admin.from("marketplace_express_orders").select("checkout_session_id").eq("id", p.order).eq("channel", "stripe").abortSignal(AbortSignal.timeout(8000)).single();
  // The paid event must match the exact Checkout Session persisted before its
  // URL was returned. An early webhook is retried after that write commits.
  if (readError || !order || order.checkout_session_id !== p.session) throw new Error("PAYMENT_RECONCILIATION_REQUIRED");
  const { error } = await admin.rpc("marketplace_express_paid", { p_order: p.order, p_channel: "stripe", p_reference: p.reference, p_event: p.event, p_amount: 29900, p_currency: "dop", p_actor_label: "stripe_signed_webhook" }).abortSignal(AbortSignal.timeout(8000));
  rpcFailure(error);
  const { error: reconcileError } = await admin.rpc("marketplace_express_reconcile", { p_order: p.order }).abortSignal(AbortSignal.timeout(8000));
  rpcFailure(reconcileError);
}
