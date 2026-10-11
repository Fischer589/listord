import { employerDepositEnabled } from "@/lib/release-gates";
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
  if (!employerDepositEnabled()) return NextResponse.json({ error: "Los depósitos están temporalmente deshabilitados. El contacto con trabajadores es gratis." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const supabase = getSupabaseAdminClient();

  if (!stripeSecretKey || !supabase) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 503 });
  }

  let origin: string;
  try {
    const configured = new URL(process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "");
    if (configured.protocol !== "https:" || configured.username || configured.password || configured.pathname !== "/" || configured.search || configured.hash) throw new Error("INVALID_ORIGIN");
    origin = configured.origin;
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 503 });
  }

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

    const { data, error } = await supabase.from("employer_payments").insert({
      stripe_session_id: session.id,
      amount: EMPLOYER_DEPOSIT_AMOUNT_CENTS,
      currency: EMPLOYER_DEPOSIT_CURRENCY,
      status: "pending"
    }).select("id").single();

    if (error || !data?.id) {
      console.warn("Employer deposit payment record insert failed.", { code: error?.code });
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 503 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Employer deposit checkout initiation failed:", {
      message: getStripeErrorMessage(error)
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
