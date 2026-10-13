import { NextResponse } from "next/server";
import Stripe from "stripe";
import { readJsonBody } from "@/lib/http-json";
import { verifiedMarketplaceUser } from "@/lib/marketplace-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { uuid } from "@/lib/marketplace";
import { FEATURED_AMOUNT_CENTS, FEATURED_CURRENCY, FEATURED_PURPOSE, featuredCheckoutReady } from "@/lib/marketplace-featured";
import { workspaceOrigin } from "@/lib/employer-workspace";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

export async function POST(request: Request) {
  if (!featuredCheckoutReady(request.url)) return reply("Pago no disponible.", 503);
  let body: unknown;
  try { body = await readJsonBody(request, 256); }
  catch { return reply("Solicitud no válida.", 400); }
  const opportunityId = body && typeof body === "object" && "opportunityId" in body ? body.opportunityId : null;
  if (!uuid(opportunityId)) return reply("Oportunidad no válida.", 400);
  let ownerId: string;
  try { ownerId = await verifiedMarketplaceUser(request); }
  catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 503;
    return reply(status === 401 ? "Verifica tu correo para comprar." : "Pago no disponible.", status);
  }
  const db = getSupabaseAdminClient();
  if (!db) return reply("Pago no disponible.", 503);
  const { data: orderId, error: reserveError } = await db.rpc("marketplace_featured_reserve", { p_actor: ownerId, p_opportunity: opportunityId });
  if (reserveError || !orderId) return reply(reserveError?.message?.includes("NOT_ELIGIBLE") ? "Solo puedes destacar una oportunidad propia, aprobada y activa." : reserveError?.message?.includes("ALREADY_FEATURED") ? "Esta oportunidad ya está destacada." : "Pago no disponible.", reserveError?.message?.includes("NOT_ELIGIBLE") ? 403 : reserveError?.message?.includes("ALREADY_FEATURED") ? 409 : 503);
  const { data: order, error: orderError } = await db.from("marketplace_featured_orders")
    .select("id,owner_user_id,opportunity_id,status,stripe_session_id,created_at")
    .eq("id", orderId).eq("owner_user_id", ownerId).eq("opportunity_id", opportunityId).maybeSingle();
  if (orderError || !order || order.status !== "pending") return reply("Pago no disponible.", 503);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
  if (order.stripe_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      if (existing.status === "open" && existing.url?.startsWith("https://checkout.stripe.com/") &&
          existing.metadata?.purpose === FEATURED_PURPOSE && existing.metadata?.order_id === order.id &&
          existing.metadata?.opportunity_id === opportunityId && existing.client_reference_id === ownerId &&
          existing.mode === "payment" && existing.amount_total === FEATURED_AMOUNT_CENTS &&
          existing.currency?.toLowerCase() === FEATURED_CURRENCY) {
        return NextResponse.json({ url: existing.url }, { headers });
      }
      if (existing.status !== "expired") return reply("Esperando confirmación del pago.", 409);
    } catch { return reply("Pago no disponible.", 503); }
    const { error } = await db.rpc("marketplace_featured_fail", { p_order: order.id, p_session: order.stripe_session_id });
    if (error) return reply("Pago no disponible.", 503);
    return reply("La sesión venció. Vuelve a intentarlo.", 409);
  }
  if (new Date(order.created_at).getTime() < Date.now() - 46 * 60_000) {
    const { error } = await db.rpc("marketplace_featured_fail", { p_order: order.id, p_session: null });
    return reply(error ? "Pago no disponible." : "Vuelve a intentarlo.", error ? 503 : 409);
  }
  try {
    const origin = workspaceOrigin();
    const session = await stripe.checkout.sessions.create({
      ui_mode: "hosted_page", mode: "payment", payment_method_types: ["card"], locale: "es",
      expires_at: Math.floor(Date.now() / 1000) + 45 * 60,
      line_items: [{ price_data: { currency: FEATURED_CURRENCY, unit_amount: FEATURED_AMOUNT_CENTS,
        product_data: { name: "Oportunidad destacada ListoRD · 7 días", description: "Pago único. Sin renovación automática." } }, quantity: 1 }],
      client_reference_id: ownerId,
      metadata: { purpose: FEATURED_PURPOSE, order_id: order.id, owner_user_id: ownerId, opportunity_id: opportunityId },
      success_url: `${origin}/empleadores/mi-cuenta?featured=return`,
      cancel_url: `${origin}/empleadores/mi-cuenta?featured=cancel`
    }, { idempotencyKey: `featured:${order.id}` });
    if (!session.id || !session.url?.startsWith("https://checkout.stripe.com/")) throw new Error("INVALID_SESSION");
    const { data: bound, error } = await db.from("marketplace_featured_orders")
      .update({ stripe_session_id: session.id }).eq("id", order.id).eq("owner_user_id", ownerId)
      .eq("status", "pending").is("stripe_session_id", null).select("id").maybeSingle();
    if (error || !bound?.id) return reply("Pago no disponible.", 503);
    return NextResponse.json({ url: session.url }, { headers });
  } catch {
    await db.rpc("marketplace_featured_fail", { p_order: order.id, p_session: null });
    return reply("No pudimos iniciar el pago.", 503);
  }
}
