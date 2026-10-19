import { NextResponse } from "next/server";
import Stripe from "stripe";
import { verifiedMarketplaceUser } from "@/lib/marketplace-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { DIRECT_CONTACT_AMOUNT_CENTS, DIRECT_CONTACT_CURRENCY, DIRECT_CONTACT_PURPOSE, directContactCheckoutReady } from "@/lib/direct-contact";
import { isUuid, workspaceOrigin, workspaceSessionPattern, workspaceSessionPrefix } from "@/lib/employer-workspace";
import { readJsonBody } from "@/lib/http-json";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const unavailable = () => NextResponse.json({ error: "El pago de contacto no está disponible ahora." }, { status: 503, headers });

export async function POST(request: Request) {
  const prefix = workspaceSessionPrefix();
  if (!prefix || !directContactCheckoutReady(request.url)) return unavailable();
  const body = await readJsonBody(request, 256).catch(() => null) as { workerId?: unknown; browserSessionId?: unknown } | null;
  if (!isUuid(body?.workerId) || (body?.browserSessionId !== undefined && !isUuid(body.browserSessionId)) || !body || Object.keys(body).some(key => key !== "workerId" && key !== "browserSessionId")) {
    return NextResponse.json({ error: "Selecciona un trabajador válido." }, { status: 400, headers });
  }
  let ownerId: string;
  try { ownerId = await verifiedMarketplaceUser(request); }
  catch { return NextResponse.json({ error: "Verifica tu correo para comprar." }, { status: 401, headers }); }
  const db = getSupabaseAdminClient();
  if (!db) return unavailable();
  const workerId = body.workerId;
  const { data: worker, error: workerError } = await db.from("workers")
    .select("id,whatsapp_number").eq("id", workerId).eq("is_verified", true).maybeSingle();
  if (workerError) return unavailable();
  if (!worker || !buildWhatsAppUrl(worker.whatsapp_number)) {
    return NextResponse.json({ error: "Este contacto no está disponible." }, { status: 404, headers });
  }
  const [workspace, existing] = await Promise.all([
    db.from("employer_workspace_orders").select("id").eq("owner_user_id", ownerId).eq("status", "paid")
      .gt("access_until", new Date().toISOString()).like("stripe_session_id", workspaceSessionPattern(prefix)).limit(1),
    db.from("employer_direct_contact_orders").select("id").eq("owner_user_id", ownerId).eq("worker_id", workerId)
      .eq("status", "paid").like("stripe_session_id", workspaceSessionPattern(prefix)).limit(1),
  ]);
  if (workspace.error || existing.error) return unavailable();
  if (workspace.data?.length || existing.data?.length) return NextResponse.json({ alreadyActive: true }, { headers });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
  const priceId = process.env.STRIPE_DIRECT_CONTACT_PRICE_ID!.trim();
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.type !== "one_time" || price.currency !== DIRECT_CONTACT_CURRENCY ||
        price.unit_amount !== DIRECT_CONTACT_AMOUNT_CENTS || price.livemode !== prefix.startsWith("cs_live_")) return unavailable();
    const { data: pending, error: pendingError } = await db.from("employer_direct_contact_orders")
      .select("id,stripe_session_id,created_at").eq("owner_user_id", ownerId).eq("worker_id", workerId)
      .eq("status", "pending").maybeSingle();
    if (pendingError) return unavailable();
    if (pending?.stripe_session_id) {
      const session = await stripe.checkout.sessions.retrieve(pending.stripe_session_id);
      if (!session.id.startsWith(prefix) || session.mode !== "payment" ||
          session.client_reference_id !== ownerId || session.metadata?.purpose !== DIRECT_CONTACT_PURPOSE ||
          session.metadata.order_id !== pending.id || session.metadata.owner_user_id !== ownerId ||
          session.metadata.worker_id !== workerId || session.amount_total !== DIRECT_CONTACT_AMOUNT_CENTS ||
          session.currency?.toLowerCase() !== DIRECT_CONTACT_CURRENCY) return unavailable();
      if (session.status === "open" && session.url?.startsWith("https://checkout.stripe.com/")) {
        return NextResponse.json({ url: session.url, sessionId: session.id }, { headers });
      }
      if (session.status !== "expired") return NextResponse.json({ error: "Esperando confirmación del pago." }, { status: 409, headers });
    }
    if (pending && !pending.stripe_session_id && Date.parse(pending.created_at) > Date.now() - 46 * 60_000) {
      return NextResponse.json({ error: "Tu pago se está preparando. Intenta en un momento." }, { status: 409, headers });
    }
    if (pending) {
      const retired = await db.from("employer_direct_contact_orders").update({ status: "failed" })
        .eq("id", pending.id).eq("status", "pending");
      if (retired.error) return unavailable();
    }
    const { data: order, error: orderError } = await db.from("employer_direct_contact_orders")
      .insert({ owner_user_id: ownerId, worker_id: workerId, amount: DIRECT_CONTACT_AMOUNT_CENTS, currency: DIRECT_CONTACT_CURRENCY })
      .select("id").single();
    if (orderError || !order?.id) return unavailable();
    try {
      const origin = workspaceOrigin();
      const session = await stripe.checkout.sessions.create({
        mode: "payment", payment_method_types: ["card"], locale: "es",
        branding_settings: { display_name: "BLACKTHORNE INDUSTRIES", background_color: "#FDFCF8", button_color: "#1A3D2B", font_family: "inter" },
        expires_at: Math.floor(Date.now() / 1000) + 45 * 60,
        line_items: [{ price: priceId, quantity: 1 }], client_reference_id: ownerId,
        metadata: { purpose: DIRECT_CONTACT_PURPOSE, order_id: order.id, owner_user_id: ownerId, worker_id: workerId },
        success_url: `${origin}/empleadores/mi-cuenta?checkout=return&product=direct&worker=${encodeURIComponent(workerId)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/empleadores/mi-cuenta?checkout=cancel&product=direct&worker=${encodeURIComponent(workerId)}`,
      }, { idempotencyKey: `direct-contact:${order.id}` });
      if (!session.id.startsWith(prefix) || !session.url?.startsWith("https://checkout.stripe.com/")) throw new Error("INVALID_SESSION");
      const { data: bound, error: bindError } = await db.from("employer_direct_contact_orders")
        .update({ stripe_session_id: session.id, browser_session_id: body.browserSessionId ?? null }).eq("id", order.id).eq("owner_user_id", ownerId)
        .eq("worker_id", workerId).eq("status", "pending").select("id").maybeSingle();
      if (bindError || !bound?.id) return unavailable();
      return NextResponse.json({ url: session.url, sessionId: session.id }, { headers });
    } catch {
      await db.from("employer_direct_contact_orders").update({ status: "failed" })
        .eq("id", order.id).eq("status", "pending").is("stripe_session_id", null);
      return unavailable();
    }
  } catch { return unavailable(); }
}
