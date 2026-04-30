import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getPaidAccessUntil,
  getPremiumAccessByCheckoutSession,
  upsertPremiumAccess,
  type PremiumPlan
} from "@/lib/premium-access";

function getStripeCustomerId(customer: Stripe.Checkout.Session["customer"]) {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id")?.trim();
  const browserSessionId = url.searchParams.get("browser_session_id")?.trim();

  if (!sessionId) {
    return NextResponse.json(
      { error: "Falta session_id.", premium: false },
      { status: 400 }
    );
  }

  try {
    let premiumAccess = await getPremiumAccessByCheckoutSession(
      sessionId,
      browserSessionId
    );

    if (!premiumAccess) {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

      if (!stripeSecretKey) {
        return NextResponse.json({
          premium: false,
          plan: null,
          paid_access_until: null
        });
      }

      const stripe = new Stripe(stripeSecretKey);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const plan = session.metadata?.plan;
      const sessionBrowserId =
        session.metadata?.browser_session_id?.trim() ||
        (typeof session.client_reference_id === "string"
          ? session.client_reference_id.trim()
          : "");
      const requestedBrowserId = browserSessionId || sessionBrowserId;
      const isMatchingBrowserSession =
        !browserSessionId || browserSessionId === sessionBrowserId;

      if (
        session.status === "complete" &&
        session.payment_status === "paid" &&
        (plan === "weekly" || plan === "monthly") &&
        sessionBrowserId &&
        isMatchingBrowserSession
      ) {
        const paidAccessUntil = getPaidAccessUntil(plan).toISOString();

        await upsertPremiumAccess({
          browser_session_id: requestedBrowserId,
          stripe_checkout_session_id: session.id,
          stripe_customer_id: getStripeCustomerId(session.customer),
          plan: plan as PremiumPlan,
          paid_access_until: paidAccessUntil
        });

        premiumAccess = {
          browser_session_id: requestedBrowserId,
          plan: plan as PremiumPlan,
          paid_access_until: paidAccessUntil
        };
      }
    }

    return NextResponse.json({
      premium: Boolean(premiumAccess),
      plan: premiumAccess?.plan ?? null,
      paid_access_until: premiumAccess?.paid_access_until ?? null
    });
  } catch {
    return NextResponse.json(
      {
        error: "No pudimos verificar tu pago todavía. Intenta de nuevo.",
        premium: false
      },
      { status: 500 }
    );
  }
}
