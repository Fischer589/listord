import { NextResponse } from "next/server";
import Stripe from "stripe";
import { verifiedMarketplaceUser } from "@/lib/marketplace-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { CONTACT_CREDIT_PACKS, CONTACT_CREDIT_PURPOSE, contactCreditCheckoutReady, parseContactCreditPack } from "@/lib/contact-credits";
import { isUuid, workspaceOrigin, workspaceSessionPrefix } from "@/lib/employer-workspace";
import { readJsonBody } from "@/lib/http-json";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const unavailable = () => NextResponse.json({ error: "El pago no está disponible ahora." }, { status: 503, headers });

export async function POST(request: Request) {
  if (!contactCreditCheckoutReady(request.url)) return unavailable();
  const body = await readJsonBody(request, 256).catch(() => null) as { pack?: unknown; workerId?: unknown } | null;
  const pack = parseContactCreditPack(body?.pack);
  if (!pack || !body || (body.workerId !== undefined && !isUuid(body.workerId)) ||
      Object.keys(body).some(key => key !== "pack" && key !== "workerId")) return NextResponse.json({ error: "Elige un paquete válido." }, { status: 400, headers });
  let ownerId: string;
  try { ownerId = await verifiedMarketplaceUser(request); }
  catch { return NextResponse.json({ error: "Verifica tu correo para comprar." }, { status: 401, headers }); }
  const db = getSupabaseAdminClient();
  const prefix = workspaceSessionPrefix();
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const definition = CONTACT_CREDIT_PACKS[pack];
  const priceId = process.env[definition.env]?.trim();
  if (!db || !prefix || !secret || !priceId || !/^price_[A-Za-z0-9]+$/.test(priceId)) return unavailable();
  const stripe = new Stripe(secret);
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.type !== "one_time" || price.currency !== "dop" ||
        price.unit_amount !== definition.amount || price.livemode !== (prefix === "cs_live_")) return unavailable();
    const pending = await db.from("employer_contact_credit_orders")
      .select("id,stripe_session_id,created_at").eq("owner_user_id", ownerId)
      .eq("pack_size", pack).eq("status", "pending").maybeSingle();
    if (pending.error) return unavailable();
    if (pending.data) {
      if (pending.data.stripe_session_id) {
        const existing = await stripe.checkout.sessions.retrieve(pending.data.stripe_session_id);
        if (existing.id.startsWith(prefix) && existing.client_reference_id === ownerId &&
            existing.metadata?.purpose === CONTACT_CREDIT_PURPOSE && existing.metadata.order_id === pending.data.id &&
            existing.metadata.owner_user_id === ownerId && existing.metadata.pack_size === String(pack) &&
            existing.mode === "payment" && existing.amount_total === definition.amount && existing.currency === "dop") {
          if (existing.status === "open" && existing.url?.startsWith("https://checkout.stripe.com/")) {
            return NextResponse.json({ url: existing.url, sessionId: existing.id }, { headers });
          }
          if (existing.status !== "expired") return NextResponse.json({ error: "Esperando confirmación del pago." }, { status: 409, headers });
        } else return unavailable();
      } else if (Date.parse(pending.data.created_at) > Date.now() - 46 * 60_000) {
        return NextResponse.json({ error: "Tu pago se está preparando. Intenta de nuevo en un momento." }, { status: 409, headers });
      }
      const retired = await db.from("employer_contact_credit_orders").update({ status: "failed" })
        .eq("id", pending.data.id).eq("status", "pending");
      if (retired.error) return unavailable();
    }
    const { data: order, error } = await db.from("employer_contact_credit_orders")
      .insert({ owner_user_id: ownerId, pack_size: pack, amount: definition.amount, currency: "dop" })
      .select("id").single();
    if (error?.code === "23505") return NextResponse.json({ error: "Ya tienes un pago en preparación." }, { status: 409, headers });
    if (error || !order?.id) return unavailable();
    try {
      const origin = workspaceOrigin();
      const workerReturn = isUuid(body.workerId) ? `&worker=${encodeURIComponent(body.workerId)}` : "";
      const session = await stripe.checkout.sessions.create({
        mode: "payment", locale: "es", line_items: [{ price: priceId, quantity: 1 }],
        expires_at: Math.floor(Date.now() / 1000) + 45 * 60,
        client_reference_id: ownerId,
        metadata: { purpose: CONTACT_CREDIT_PURPOSE, order_id: order.id, owner_user_id: ownerId, pack_size: String(pack) },
        success_url: `${origin}/empleadores/contacto?checkout=return${workerReturn}`,
        cancel_url: `${origin}/empleadores/contacto?checkout=cancel${workerReturn}`,
      }, { idempotencyKey: `contact-credits:${order.id}` });
      if (!session.id.startsWith(prefix) || !session.url?.startsWith("https://checkout.stripe.com/")) throw new Error("INVALID_SESSION");
      const bound = await db.from("employer_contact_credit_orders")
        .update({ stripe_session_id: session.id }).eq("id", order.id).eq("owner_user_id", ownerId)
        .eq("status", "pending").select("id").maybeSingle();
      if (bound.error || !bound.data?.id) return unavailable();
      return NextResponse.json({ url: session.url, sessionId: session.id }, { headers });
    } catch {
      await db.from("employer_contact_credit_orders").update({ status: "failed" })
        .eq("id", order.id).eq("status", "pending").is("stripe_session_id", null);
      return unavailable();
    }
  } catch { return unavailable(); }
}
