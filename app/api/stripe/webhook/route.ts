import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getPaidAccessUntil,
  upsertPremiumAccess,
  type PremiumPlan
} from "@/lib/premium-access";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { BOOST_AMOUNT_CENTS, BOOST_CURRENCY } from "@/lib/boost";
import { activateWorkerBoost } from "@/lib/boost-data";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

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
  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json(
      { error: "Firma de Stripe invalida." },
      { status: 400 }
    );
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // ─── Worker profile boost — one-time RD$100 payment ─────────────
  // Handled separately from the employer premium-access flow below (which
  // owns the weekly/monthly subscription branch). Kept in the same route
  // per the existing single-webhook architecture.
  if (session.metadata?.purpose === "worker_boost") {
    return handleWorkerBoostWebhook(session);
  }

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
      paid_access_until: getPaidAccessUntil(plan).toISOString()
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
