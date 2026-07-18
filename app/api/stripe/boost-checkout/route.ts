import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  BOOST_AMOUNT_CENTS,
  BOOST_CURRENCY,
  getBoostRejectionMessage
} from "@/lib/boost";
import {
  checkBoostEligibility,
  findBoostableWorkerByEditToken,
  recordBoostCheckoutStarted
} from "@/lib/boost-data";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const GENERIC_ERROR = "No pudimos iniciar el pago. Intenta de nuevo.";

function getStripeErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return error instanceof Error ? error.message : "Unknown checkout error";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    edit_token?: string;
  } | null;

  const editToken = body?.edit_token?.trim();
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!editToken) {
    return NextResponse.json(
      { error: "Falta el enlace de tu perfil." },
      { status: 400 }
    );
  }

  if (!stripeSecretKey) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  // Ownership check reuses the SAME edit_token mechanism as profile editing —
  // never trust a raw worker_id from the client.
  const worker = await findBoostableWorkerByEditToken(editToken);

  if (!worker) {
    return NextResponse.json(
      { error: "No encontramos tu perfil. Verifica tu enlace de edición." },
      { status: 404 }
    );
  }

  if (!worker.is_verified) {
    return NextResponse.json(
      {
        error:
          "Tu perfil todavía está en revisión. Podrás impulsarlo una vez esté aprobado."
      },
      { status: 400 }
    );
  }

  // Server-side eligibility gate — enforced here AND re-checked in the
  // webhook. Never rely on frontend logic for the cooldown/24h rules.
  const eligibility = checkBoostEligibility(worker);

  if (!eligibility.allowed) {
    return NextResponse.json(
      { error: getBoostRejectionMessage(eligibility) },
      { status: 429 }
    );
  }

  const origin =
    request.headers.get("origin") || nextPublicAppUrl || "http://localhost:3000";

  try {
    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: BOOST_CURRENCY,
            unit_amount: BOOST_AMOUNT_CENTS,
            product_data: {
              name: "Impulso de perfil ListoRD — 24 horas",
              description: `Prioridad de visibilidad para ${worker.full_name} en ${worker.city}`
            }
          },
          quantity: 1
        }
      ],
      metadata: {
        purpose: "worker_boost",
        worker_id: worker.id
      },
      client_reference_id: worker.id,
      success_url: `${origin}/trabajadores/boost-exitoso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/trabajadores/editar?token=${encodeURIComponent(editToken)}`
    });

    if (!session.url) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
    }

    await recordBoostCheckoutStarted({
      workerId: worker.id,
      stripeCheckoutSessionId: session.id,
      amount: BOOST_AMOUNT_CENTS,
      currency: BOOST_CURRENCY
    });

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase.from("analytics_events").insert({
        event_name: "boost_purchase_started",
        metadata: { worker_id: worker.id, city: worker.city }
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Boost checkout initiation failed:", {
      message: getStripeErrorMessage(error)
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
