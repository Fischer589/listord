import { NextResponse } from "next/server";
import Stripe from "stripe";
import { recordExpressPayment } from "@/lib/express-server";
import { recordWorkspacePayment, revokeWorkspacePayment } from "@/lib/employer-workspace-payment";
import { WORKSPACE_PURPOSE } from "@/lib/employer-workspace";
import { FEATURED_PURPOSE } from "@/lib/marketplace-featured";
import { recordFeaturedPayment, revokeFeaturedPayment } from "@/lib/marketplace-featured-payment";
import { DIRECT_CONTACT_PURPOSE } from "@/lib/direct-contact";
import { recordDirectContactPayment, revokeDirectContactPayment } from "@/lib/direct-contact-payment";
import { readBoundedText } from "@/lib/http-json";
import {
  getPaidAccessUntil,
  upsertPremiumAccess,
  type PremiumPlan
} from "@/lib/premium-access";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { BOOST_AMOUNT_CENTS, BOOST_CURRENCY } from "@/lib/boost";
import { activateWorkerBoost } from "@/lib/boost-data";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  EMPLOYER_DEPOSIT_AMOUNT_CENTS,
  EMPLOYER_DEPOSIT_CURRENCY
} from "@/lib/employer-deposit";

export const runtime = "nodejs";

function getStripeCustomerId(customer: Stripe.Checkout.Session["customer"]) {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

function getStripeSubscriptionId(
  subscription: Stripe.Checkout.Session["subscription"]
) {
  if (!subscription) {
    return null;
  }

  return typeof subscription === "string" ? subscription : subscription.id;
}

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "No pudimos procesar el evento de pago." },
      { status: 500 }
    );
  }

  if (!signature) {
    return NextResponse.json(
      { error: "Falta stripe-signature." },
      { status: 400 }
    );
  }

  const stripe = new Stripe(stripeSecretKey);
  let event: Stripe.Event;

  try {
    const rawBody = await readBoundedText(request, 65536);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json(
      { error: "Firma de Stripe invalida." },
      { status: 400 }
    );
  }

  if (event.type === "charge.dispute.created") {
    return (await revokeDirectContactPayment(event, stripe)) ?? NextResponse.json({ received: true });
  }
  if (event.type === "charge.refunded" &&
      (event.data.object as Stripe.Charge).payment_intent) {
    const direct = await revokeDirectContactPayment(event, stripe);
    if (direct) return direct;
    const featured = await revokeFeaturedPayment(event, stripe);
    if (featured) return featured;
    return revokeWorkspacePayment(event, stripe);
  }
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type) &&
      (event.data.object as Stripe.Checkout.Session).metadata?.purpose === FEATURED_PURPOSE) {
    return recordFeaturedPayment(event);
  }
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type) &&
      (event.data.object as Stripe.Checkout.Session).metadata?.purpose === WORKSPACE_PURPOSE) {
    return recordWorkspacePayment(event);
  }
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type) &&
      (event.data.object as Stripe.Checkout.Session).metadata?.purpose === DIRECT_CONTACT_PURPOSE) {
    return recordDirectContactPayment(event);
  }

  if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && (event.data.object as Stripe.Checkout.Session).metadata?.purpose === "listord_express") {
    try { await recordExpressPayment(event); return NextResponse.json({ received: true }); }
    catch { return NextResponse.json({ error: "Express requiere reconciliación; el evento puede reintentarse." }, { status: 503 }); }
  }

  if (event.type === "checkout.session.async_payment_succeeded" && (event.data.object as Stripe.Checkout.Session).metadata?.purpose === "employer_deposit") {
    return handleEmployerDepositWebhook(event.data.object as Stripe.Checkout.Session);
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // ─── Worker profile boost — one-time RD$100 payment ───────────
  // Handled separately from the employer premium-access flow below (which
  // owns the weekly/monthly subscription branch). Kept in the same route
  // per the existing single-webhook architecture.
  if (session.metadata?.purpose === "worker_boost") {
    return handleWorkerBoostWebhook(session);
  }

  // ─── Employer deposit — one-time RD$3,000 payment ──────────
  if (session.metadata?.purpose === "employer_deposit") {
    return handleEmployerDepositWebhook(session);
  }

  // Preserve historical reconciliation without granting unpaid or replay-extended access.
  if (session.payment_status !== "paid") return NextResponse.json({ received: true });

  const plan = session.metadata?.plan;

  if (plan !== "weekly" && plan !== "monthly") {
    return NextResponse.json(
      { error: "Plan de pago invalido en metadata." },
      { status: 400 }
    );
  }

  try {
    await upsertPremiumAccess({
      browser_session_id: session.metadata?.browser_session_id?.trim() || null,
      whatsapp_number: normalizeWhatsAppNumber(session.metadata?.whatsapp_number),
      stripe_checkout_session_id: session.id,
      stripe_customer_id: getStripeCustomerId(session.customer),
      stripe_subscription_id: getStripeSubscriptionId(session.subscription),
      plan: plan as PremiumPlan,
      status: "active",
      paid_access_until: getPaidAccessUntil(plan, new Date(event.created * 1000)).toISOString()
    });

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "No pudimos procesar el evento de pago." },
      { status: 500 }
    );
  }
}


async function handleWorkerBoostWebhook(session: Stripe.Checkout.Session) {
  const workerId = session.metadata?.worker_id?.trim();

  if (!workerId) {
    console.warn("Boost webhook missing worker_id metadata.", { sessionId: session.id });
    return NextResponse.json(
      { error: "Falta worker_id en metadata." },
      { status: 400 }
    );
  }

  // Verify payment actually succeeded before touching anything.
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  // Verify amount + currency match the expected boost price — never trust
  // the client, and never activate a boost for a tampered/partial amount.
  const amountTotal = session.amount_total ?? 0;
  const currency = (session.currency || "").toLowerCase();

  if (amountTotal !== BOOST_AMOUNT_CENTS || currency !== BOOST_CURRENCY) {
    console.error("Boost webhook amount/currency mismatch — refusing to activate.", {
      sessionId: session.id,
      amountTotal,
      currency
    });
    return NextResponse.json(
      { error: "Monto o moneda no coinciden con el impulso esperado." },
      { status: 400 }
    );
  }

  try {
    // Idempotent + atomic: the RPC itself checks whether this exact
    // checkout session was already processed before mutating anything.
    const result = await activateWorkerBoost({
      workerId,
      stripeCheckoutSessionId: session.id,
      amount: amountTotal,
      currency
    });

    if (!result) {
      return NextResponse.json(
        { error: "No pudimos activar el impulso." },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdminClient();

    if (result.already_processed) {
      return NextResponse.json({ received: true, already_processed: true });
    }

    if (supabase) {
      await supabase.from("analytics_events").insert([
        {
          event_name: "boost_payment_success",
          metadata: { worker_id: workerId, session_id: session.id }
        },
        {
          event_name: "boost_activated",
          metadata: {
            worker_id: workerId,
            consecutive_boost_count: result.consecutive_boost_count,
            boost_expires_at: result.boost_expires_at
          }
        }
      ]);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Boost webhook activation failed.", {
      sessionId: session.id,
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: "No pudimos activar el impulso." },
      { status: 500 }
    );
  }
}


async function handleEmployerDepositWebhook(session: Stripe.Checkout.Session) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    console.warn("Employer deposit webhook skipped: Supabase admin client unavailable.");
    return NextResponse.json(
      { error: "No pudimos procesar el evento de pago." },
      { status: 500 }
    );
  }

  // Idempotency guard: if this session was already marked paid, do nothing.
  const { data: existing, error: lookupError } = await supabase
    .from("employer_payments")
    .select("status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (lookupError || !existing) {
    return NextResponse.json({ error: "El depósito requiere reconciliación; el evento puede reintentarse." }, { status: 503 });
  }

  if (existing.status === "paid" || existing.status === "refunded") {
    return NextResponse.json({ received: true, already_processed: true });
  }

  // Verify payment actually succeeded before touching anything.
  if (session.payment_status !== "paid") {
    if (session.payment_status === "unpaid" && session.status === "expired") {
      await supabase
        .from("employer_payments")
        .update({ status: "failed" })
        .eq("stripe_session_id", session.id);
    }
    return NextResponse.json({ received: true });
  }

  // Verify amount + currency match the expected deposit price — never trust
  // the client, and never mark a payment as paid for a tampered/partial amount.
  const amountTotal = session.amount_total ?? 0;
  const currency = (session.currency || "").toLowerCase();

  if (session.mode !== "payment" || amountTotal !== EMPLOYER_DEPOSIT_AMOUNT_CENTS || currency !== EMPLOYER_DEPOSIT_CURRENCY) {
    console.error("Employer deposit webhook amount/currency mismatch — refusing to mark paid.", {
      sessionId: session.id,
      amountTotal,
      currency
    });
    return NextResponse.json(
      { error: "Monto o moneda no coinciden con el depósito esperado." },
      { status: 400 }
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const customerDetails = session.customer_details;

  if (!paymentIntentId) {
    return NextResponse.json({ error: "Falta la referencia de pago de Stripe." }, { status: 503 });
  }

  try {
    const { data: updated, error } = await supabase
      .from("employer_payments")
      .update({
        status: "paid",
        stripe_payment_id: paymentIntentId,
        customer_name: customerDetails?.name ?? null,
        customer_email: customerDetails?.email ?? null,
        customer_phone: customerDetails?.phone ?? null,
        paid_at: new Date().toISOString()
      })
      .eq("stripe_session_id", session.id)
      .eq("status", existing.status)
      .select("id")
      .maybeSingle();

    if (error || !updated?.id) {
      console.error("Employer deposit payment update failed.", {
        sessionId: session.id,
        code: error?.code
      });
      return NextResponse.json(
        { error: "No pudimos registrar el pago." },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Employer deposit webhook failed unexpectedly.", {
      sessionId: session.id,
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: "No pudimos registrar el pago." },
      { status: 500 }
    );
  }
}
