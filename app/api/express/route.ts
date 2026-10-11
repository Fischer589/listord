import { NextResponse } from "next/server";
import Stripe from "stripe";
import { readJsonBody } from "@/lib/http-json";
import { MARKETPLACE_HEADERS as headers, marketplaceEnabled, object, uuid } from "@/lib/marketplace";
import { MarketplaceError, marketplaceAdmin, rpcFailure, verifiedMarketplaceUser } from "@/lib/marketplace-server";
import { checkoutParameters, expressCheckoutUrl, expressEnabled, EXPRESS_TERMS, type ExpressOrder } from "@/lib/express";
import { outreachConfigured } from "@/lib/express-provider";
import { availabilityRenewalEnabled } from "@/lib/availability";
import { parseMatchRequest } from "@/lib/request-matching";
import { getRequestMatches } from "@/lib/request-match-server";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
export async function GET(request: Request) {
  if (!marketplaceEnabled()) return json({ error: "Deshabilitado." }, 503);
  const target = new URL(request.url).searchParams.get("id");
  if (target && (!expressEnabled() || !outreachConfigured() || !availabilityRenewalEnabled())) return json({ error: "Express no está disponible. No se realizará ningún cobro." }, 503);
  try {
    const actor = await verifiedMarketplaceUser(request);
    const admin = marketplaceAdmin();
    if (target) {
      if (!uuid(target)) return json({ error: "Solicitud inválida." }, 400);
      if (!expressEnabled() || !outreachConfigured() || !availabilityRenewalEnabled()) return json({ error: "Express no está disponible. No se realizará ningún cobro." }, 503);
      const targets = await deliverableTargets(actor, target);
      return json({ eligibleCount: targets.length, amount: 29900, currency: "dop", terms: EXPRESS_TERMS });
    }
    const { data, error } = await admin.from("marketplace_express_orders").select("id,opportunity_id,status,reference,amount,currency,deadline,created_at").eq("owner_user_id", actor).order("created_at", { ascending: false }).limit(50).abortSignal(AbortSignal.timeout(8000));
    if (error) throw error;
    for (const order of data ?? []) {
      if (order.status === "paid") {
        const result = await admin.rpc("marketplace_express_reconcile", { p_order: order.id }).abortSignal(AbortSignal.timeout(8000));
        rpcFailure(result.error); order.status = result.data;
      }
    }
    return json({ orders: data });
  } catch (e) { return json({ error: e instanceof MarketplaceError ? e.message : "No se pudieron cargar los pagos." }, e instanceof MarketplaceError ? e.status : 503); }
}
export async function POST(request: Request) {
  if (!expressEnabled() || !outreachConfigured() || !availabilityRenewalEnabled()) return json({ error: "Express no está disponible: faltan verificaciones de entrega, pago y términos. No se realizará ningún cobro." }, 503);
  const b = object(await readJsonBody(request, 2048).catch(() => null));
  if (!b || !uuid(b.id) || !["stripe", "transfer"].includes(String(b.channel)) || b.terms !== EXPRESS_TERMS) return json({ error: "Confirma la solicitud y los términos." }, 400);
  try {
    const actor = await verifiedMarketplaceUser(request); const admin = marketplaceAdmin();
    const targets = await deliverableTargets(actor, b.id);
    if (!targets.length) return json({ error: "No hay destinatarios compatibles con consentimiento vigente. No se realizará ningún cobro." }, 409);
    const { data: id, error } = await admin.rpc("marketplace_express_reserve", { p_actor: actor, p_id: b.id, p_channel: b.channel, p_workers: targets }).abortSignal(AbortSignal.timeout(8000));
    rpcFailure(error);
    const { data: order, error: orderError } = await admin.from("marketplace_express_orders").select("id,opportunity_id,channel,status,created_at,checkout_session_id,reference").eq("id", id).abortSignal(AbortSignal.timeout(8000)).single();
    if (orderError || !order) throw new Error();
    if (order.status !== "payment_pending") return json({ order: order.id, status: order.status });
    const chargeable = await admin.rpc("marketplace_express_chargeable", { p_order: order.id }).abortSignal(AbortSignal.timeout(8000));
    rpcFailure(chargeable.error);
    if (chargeable.data !== true) return json({ error: "La entrega ya no se puede confirmar. No se abrirá un nuevo pago." }, 409);
    if (b.channel === "transfer") {
      const url = buildWhatsAppUrl(process.env.EXPRESS_TRANSFER_CONTACT);
      if (!url) return json({ error: "El contacto de transferencias no está verificado. No envíes dinero." }, 503);
      return json({ order: order.id, status: "payment_pending", reference: order.reference, url: `${url}?text=${encodeURIComponent(`Consulta sobre ListoRD Express RD$299 para la oportunidad ${order.opportunity_id}. Referencia ${order.reference}. Solicito instrucciones verificadas; todavía no se ha confirmado ningún pago.`)}` });
    }
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error();
    const stripe = new Stripe(key, { timeout: 8000, maxNetworkRetries: 1 });
    let session;
    if (order.checkout_session_id) session = await stripe.checkout.sessions.retrieve(order.checkout_session_id);
    else {
      session = await stripe.checkout.sessions.create(checkoutParameters(order as ExpressOrder, process.env.APP_ORIGIN ?? ""), { idempotencyKey: `express:${order.id}` });
      if (!expressCheckoutUrl(session, order.id)) throw new Error("INVALID_CHECKOUT_SESSION");
      const saved = await admin.from("marketplace_express_orders").update({ checkout_session_id: session.id })
        .eq("id", order.id).eq("status", "payment_pending").is("checkout_session_id", null)
        .select("checkout_session_id").abortSignal(AbortSignal.timeout(8000)).maybeSingle();
      if (saved.error) throw saved.error;
      if (!saved.data) {
        const current = await admin.from("marketplace_express_orders").select("checkout_session_id,status")
          .eq("id", order.id).abortSignal(AbortSignal.timeout(8000)).single();
        if (current.error || current.data?.checkout_session_id !== session.id || current.data.status !== "payment_pending") throw new Error("CHECKOUT_BINDING_FAILED");
      }
    }
    const checkoutUrl = expressCheckoutUrl(session, order.id);
    if (!checkoutUrl) return json({ error: "La sesión ya no acepta pagos. Revisa el estado; no se creó otro cobro." }, 409);
    return json({ url: checkoutUrl, order: order.id, status: "payment_pending" });
  } catch (e) { return json({ error: e instanceof MarketplaceError ? e.message : "No se confirmó la operación. Revisa el estado antes de reintentar." }, e instanceof MarketplaceError ? e.status : 503); }
}

async function deliverableTargets(actor: string, id: string): Promise<string[]> {
  const admin = marketplaceAdmin();
  const owner = await admin.from("marketplace_opportunity_owners").select("opportunity_id").eq("opportunity_id", id).eq("owner_user_id", actor).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
  if (owner.error || !owner.data) throw new MarketplaceError(403, "Solicitud no disponible.");
  const opp = await admin.from("marketplace_opportunities").select("specification").eq("id", id).eq("status", "open").eq("moderation_status", "approved").abortSignal(AbortSignal.timeout(8000)).single();
  const draft = parseMatchRequest(opp.data?.specification);
  if (opp.error || !draft) throw new MarketplaceError(409, "La solicitud no está abierta.");
  const matches = await getRequestMatches(draft);
  if (!matches.count) return [];
  const { data, error } = await admin.rpc("marketplace_express_targets", { p_actor: actor, p_id: id, p_workers: matches.workers.map(w => w.id) }).abortSignal(AbortSignal.timeout(8000));
  rpcFailure(error);
  return (data as { worker_id: string }[]).map(w => w.worker_id);
}
