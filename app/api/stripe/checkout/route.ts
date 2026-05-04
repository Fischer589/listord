import { NextResponse } from "next/server";
import Stripe from "stripe";
import { upsertEmployerSession } from "@/lib/employer-sessions";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

type CheckoutPlan = "weekly" | "monthly";

const planPriceEnv: Record<CheckoutPlan, string> = {
  weekly: "STRIPE_WEEKLY_PRICE_ID",
  monthly: "STRIPE_MONTHLY_PRICE_ID"
};

function getStripeErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      message: error instanceof Error ? error.message : "Unknown checkout error",
      code: undefined,
      type: undefined
    };
  }

  const maybeStripeError = error as {
    message?: unknown;
    code?: unknown;
    type?: unknown;
  };

  return {
    message:
      typeof maybeStripeError.message === "string"
        ? maybeStripeError.message
        : "Unknown checkout error",
    code:
      typeof maybeStripeError.code === "string"
        ? maybeStripeError.code
        : undefined,
    type:
      typeof maybeStripeError.type === "string"
        ? maybeStripeError.type
        : undefined
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    plan?: CheckoutPlan;
    browser_session_id?: string;
    client_reference_id?: string;
    whatsapp_number?: string;
  } | null;
  const plan = body?.plan;
  const browserSessionId = body?.browser_session_id?.trim();
  const clientReferenceId = body?.client_reference_id?.trim();
  const whatsappNumber = normalizeWhatsAppNumber(body?.whatsapp_number);
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const selectedPriceId =
    plan === "weekly" || plan === "monthly"
      ? process.env[planPriceEnv[plan]]?.trim()
      : undefined;
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  console.info("Stripe checkout initiation:", {
    plan_passed: plan ?? null,
    selected_price_id_exists: Boolean(selectedPriceId),
    stripe_secret_key_exists: Boolean(stripeSecretKey),
    next_public_app_url_exists: Boolean(nextPublicAppUrl)
  });

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "No pudimos iniciar el pago. Intenta de nuevo." },
      { status: 500 }
    );
  }

  if (plan !== "weekly" && plan !== "monthly") {
    return NextResponse.json(
      { error: "Plan de pago invalido." },
      { status: 400 }
    );
  }

  if (!selectedPriceId) {
    return NextResponse.json(
      { error: "No pudimos iniciar el pago. Intenta de nuevo." },
      { status: 500 }
    );
  }

  if (!whatsappNumber) {
    return NextResponse.json(
      { error: "Falta un WhatsApp valido para activar el acceso premium." },
      { status: 400 }
    );
  }

  const origin =
    request.headers.get("origin") ||
    nextPublicAppUrl ||
    "http://localhost:3000";

  try {
    await upsertEmployerSession({
      browserSessionId,
      whatsappNumber
    });

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1
        }
      ],
      metadata: {
        plan,
        browser_session_id: browserSessionId || "",
        whatsapp_number: whatsappNumber
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
  } catch (error) {
    const stripeError = getStripeErrorDetails(error);

    console.error("Stripe checkout initiation failed:", {
      stripe_error_message: stripeError.message,
      stripe_error_code: stripeError.code,
      stripe_error_type: stripeError.type
    });

    return NextResponse.json(
      { error: "No pudimos iniciar el pago. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
