import { NextResponse } from "next/server";
import Stripe from "stripe";
import { verifiedMarketplaceUser } from "@/lib/marketplace-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { WORKSPACE_AMOUNT_CENTS, WORKSPACE_CURRENCY, WORKSPACE_PURPOSE, workspaceEnabled, workspaceOrigin, workspaceStripeReady } from "@/lib/employer-workspace";
import { readJsonBody } from "@/lib/http-json";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const unavailable = () => NextResponse.json({ error: "No pudimos iniciar el pago. Intenta más tarde." }, { status: 503, headers });

export async function POST(request: Request) {
  if (!workspaceEnabled() || !workspaceStripeReady(request.url)) return unavailable();
  let body: { mode?: unknown; replaceEmbedded?: unknown } = {};
  if (request.body) {
    try {
      const input = await readJsonBody(request, 256);
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_REQUEST");
      body = input as typeof body;
      if (body.mode !== undefined && body.mode !== "embedded" && body.mode !== "hosted") throw new Error("INVALID_REQUEST");
    } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400, headers }); }
  }
  const mode = body.mode === "embedded" ? "embedded" : "hosted";
  const replaceEmbedded = body.replaceEmbedded === true && mode === "hosted";
  let ownerId: string;
  let origin: string;
  try {
    ownerId = await verifiedMarketplaceUser(request);
    origin = workspaceOrigin();
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 503;
    return NextResponse.json({ error: status === 401 ? "Verifica tu correo para comprar." : "Pago no disponible." }, { status, headers });
  }
  const db = getSupabaseAdminClient();
  if (!db) return unavailable();
  const { data: active, error: activeError } = await db.from("employer_workspace_orders")
    .select("id").eq("owner_user_id", ownerId).eq("status", "paid")
    .gt("access_until", new Date().toISOString()).limit(1);
  if (activeError) return unavailable();
  if (active?.length) return NextResponse.json({ error: "Tu espacio ya está activo." }, { status: 409, headers });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
  const { data: pending, error: pendingError } = await db.from("employer_workspace_orders")
    .select("id,stripe_session_id,created_at").eq("owner_user_id", ownerId).eq("status", "pending").maybeSingle();
  if (pendingError) return unavailable();
  if (pending?.stripe_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(pending.stripe_session_id);
      if (existing.status === "open") {
        if ((existing.ui_mode === "embedded_page" || existing.ui_mode === "embedded") && mode === "embedded" && existing.client_secret) {
          return NextResponse.json({ mode, clientSecret: existing.client_secret, sessionId: existing.id }, { headers });
        }
        if (existing.ui_mode !== "embedded_page" && existing.ui_mode !== "embedded" && existing.url?.startsWith("https://checkout.stripe.com/")) {
          return NextResponse.json({ mode: "hosted", url: existing.url, sessionId: existing.id }, { headers });
        }
        if ((existing.ui_mode === "embedded_page" || existing.ui_mode === "embedded") && replaceEmbedded) {
          await stripe.checkout.sessions.expire(existing.id);
        } else return NextResponse.json({ error: "Esperando confirmación del pago." }, { status: 409, headers });
      }
      else if (existing.status !== "expired") return NextResponse.json({ error: "Esperando confirmación del pago." }, { status: 409, headers });
    } catch { return unavailable(); }
  }
  // An unbound attempt can only be retired once its 45-minute session window
  // would have elapsed. Bound attempts are checked with Stripe above.
  if (pending && !pending.stripe_session_id && new Date(pending.created_at).getTime() > Date.now() - 46 * 60_000) {
    return NextResponse.json({ error: "Tu pago se está preparando. Intenta de nuevo en un momento." }, { status: 409, headers });
  }
  if (pending) {
    const { error: expiredError } = await db.from("employer_workspace_orders")
      .update({ status: "failed" }).eq("id", pending.id).eq("status", "pending");
    if (expiredError) return unavailable();
  }
  const { data: order, error: orderError } = await db.from("employer_workspace_orders")
    .insert({ owner_user_id: ownerId, amount: WORKSPACE_AMOUNT_CENTS, currency: WORKSPACE_CURRENCY })
    .select("id").single();
  if (orderError || !order?.id) {
    return NextResponse.json({ error: orderError?.code === "23505" ? "Ya tienes un pago pendiente. Vuelve a intentarlo en 45 minutos." : "No pudimos iniciar el pago." }, { status: orderError?.code === "23505" ? 409 : 503, headers });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: mode === "embedded" ? "embedded_page" : "hosted_page",
      mode: "payment",
      payment_method_types: ["card"],
      locale: "es",
      branding_settings: { display_name: "BLACKTHORNE INDUSTRIES", background_color: "#FDFCF8", button_color: "#1A3D2B", font_family: "inter" },
      expires_at: Math.floor(Date.now() / 1000) + 45 * 60,
      line_items: [{ price_data: { currency: WORKSPACE_CURRENCY, unit_amount: WORKSPACE_AMOUNT_CENTS,
        product_data: { name: "Espacio para empleadores ListoRD · 30 días", description: "Candidatos guardados, solicitudes privadas y registro de contactos. Sin renovación automática." }
      }, quantity: 1 }],
      client_reference_id: ownerId,
      metadata: { purpose: WORKSPACE_PURPOSE, order_id: order.id, owner_user_id: ownerId },
      ...(mode === "embedded" ? {
        redirect_on_completion: "if_required" as const,
        return_url: `${origin}/empleadores/mi-cuenta?checkout=return&session_id={CHECKOUT_SESSION_ID}`,
      } : {
        success_url: `${origin}/empleadores/mi-cuenta?checkout=return&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/empleadores/mi-cuenta?checkout=cancel`,
      })
    }, { idempotencyKey: `workspace:${order.id}` });
    if (!session.id || (mode === "embedded" ? !session.client_secret : !session.url?.startsWith("https://checkout.stripe.com/"))) throw new Error("INVALID_SESSION");
    const { data: bound, error: bindError } = await db.from("employer_workspace_orders")
      .update({ stripe_session_id: session.id }).eq("id", order.id).eq("owner_user_id", ownerId)
      .eq("status", "pending").select("id").maybeSingle();
    if (bindError || !bound?.id) return unavailable();
    return NextResponse.json(mode === "embedded"
      ? { mode, clientSecret: session.client_secret, sessionId: session.id }
      : { mode, url: session.url, sessionId: session.id }, { headers });
  } catch {
    await db.from("employer_workspace_orders").update({ status: "failed" })
      .eq("id", order.id).eq("status", "pending").is("stripe_session_id", null);
    return unavailable();
  }
}
