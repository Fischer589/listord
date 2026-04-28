import { NextResponse } from "next/server";
import Stripe from "stripe";

type CheckoutPlan = "weekly" | "monthly";

const planPriceEnv: Record<CheckoutPlan, string> = {
  weekly: "STRIPE_WEEKLY_PRICE_ID",
  monthly: "STRIPE_MONTHLY_PRICE_ID"
};

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "No pudimos iniciar el pago. Intenta de nuevo." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    plan?: CheckoutPlan;
    browser_session_id?: string;
    client_reference_id?: string;
  } | null;
  const plan = body?.plan;
  const browserSessionId = body?.browser_session_id?.trim();
  const clientReferenceId = body?.client_reference_id?.trim();

  if (plan !== "weekly" && plan !== "monthly") {
    return NextResponse.json(
      { error: "Plan de pago invalido." },
      { status: 400 }
    );
  }

  const priceId = process.env[planPriceEnv[plan]]?.trim();

  if (!priceId) {
    return NextResponse.json(
      { error: "No pudimos iniciar el pago. Intenta de nuevo." },
      { status: 500 }
    );
  }

  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  try {
    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        plan,
        browser_session_id: browserSessionId || ""
      },
      client_reference_id: clientReferenceId || browserSessionId || undefined,
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment/cancel`
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "No pudimos iniciar el pago. Intenta de nuevo." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json(
      { error: "No pudimos iniciar el pago. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
