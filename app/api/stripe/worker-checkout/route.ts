import { NextResponse } from "next/server";
import Stripe from "stripe";

type WorkerPlan = "featured" | "pro";

const planPriceEnv: Record<WorkerPlan, string> = {
  featured: "STRIPE_WORKER_FEATURED_PRICE_ID",
  pro:      "STRIPE_WORKER_PRO_PRICE_ID",
};

const planLabel: Record<WorkerPlan, string> = {
  featured: "Trabajador Destacado — RD$199/mes",
  pro:      "Perfil Pro — RD$299/mes",
};

function getStripeErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: error instanceof Error ? error.message : "Unknown checkout error" };
  }
  const e = error as { message?: unknown };
  return { message: typeof e.message === "string" ? e.message : "Unknown checkout error" };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    plan?: WorkerPlan;
    worker_id?: string;
  } | null;

  const plan = body?.plan;
  const workerId = body?.worker_id?.trim();
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  const selectedPriceId =
    plan === "featured" || plan === "pro"
      ? process.env[planPriceEnv[plan]]?.trim()
      : undefined;

  console.info("Worker Stripe checkout initiation:", {
    plan: plan ?? null,
    worker_id_exists: Boolean(workerId),
    price_id_exists:  Boolean(selectedPriceId),
    secret_key_exists: Boolean(stripeSecretKey),
  });

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "No pudimos iniciar el pago. Intenta de nuevo." },
      { status: 500 }
    );
  }

  if (plan !== "featured" && plan !== "pro") {
    return NextResponse.json(
      { error: "Plan inválido." },
      { status: 400 }
    );
  }

  if (!selectedPriceId) {
    return NextResponse.json(
      { error: "No pudimos iniciar el pago. Configura el Price ID de Stripe." },
      { status: 500 }
    );
  }

  if (!workerId) {
    return NextResponse.json(
      { error: "Falta el ID del trabajador." },
      { status: 400 }
    );
  }

  const origin =
    request.headers.get("origin") ||
    nextPublicAppUrl ||
    "http://localhost:3000";

  try {
    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: selectedPriceId, quantity: 1 }],
      metadata: {
        plan,
        worker_id: workerId,
        plan_label: planLabel[plan],
      },
      client_reference_id: workerId,
      success_url: `${origin}/trabajadores/suscripcion-exitosa?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/trabajadores/registro`,
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
    console.error("Worker Stripe checkout failed:", { message: stripeError.message });
    return NextResponse.json(
      { error: "No pudimos iniciar el pago. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
