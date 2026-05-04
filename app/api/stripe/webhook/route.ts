import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getPaidAccessUntil,
  upsertPremiumAccess,
  type PremiumPlan
} from "@/lib/premium-access";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

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
