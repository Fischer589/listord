import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  EMPLOYER_DEPOSIT_AMOUNT_CENTS,
  EMPLOYER_DEPOSIT_CURRENCY,
  EMPLOYER_DEPOSIT_PRODUCT_NAME
} from "@/lib/employer-deposit";
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
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!stripeSecretKey) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
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
            currency: EMPLOYER_DEPOSIT_CURRENCY,
            unit_amount: EMPLOYER_DEPOSIT_AMOUNT_CENTS,
            product_data: {
              name: EMPLOYER_DEPOSIT_PRODUCT_NAME,
              description: "Depósito para iniciar la búsqueda y conexión con trabajadores disponibles."
            }
          },
          quantity: 1
        }
      ],
      // Stripe's hosted page collects email always; these add name (via
      // billing address) and phone so we can populate customer_name /
      // customer_phone in the webhook without a custom pre-checkout form.
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      metadata: {
        purpose: "employer_deposit"
      },
      success_url: `${origin}/employer-deposit/exitoso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/employer-deposit`
    });

    if (!session.url) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
    }

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { error } = await supabase.from("employer_payments").insert({
        stripe_session_id: session.id,
        amount: EMPLOYER_DEPOSIT_AMOUNT_CENTS,
        currency: EMPLOYER_DEPOSIT_CURRENCY,
        status: "pending"
      });

      if (error) {
        console.warn("Employer deposit payment record insert failed.", {
          code: error.code
        });
      }
    } else {
      console.warn("Employer deposit checkout: Supabase admin client unavailable.");
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Employer deposit checkout initiation failed:", {
      message: getStripeErrorMessage(error)
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
