import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * READ-ONLY. Never activates or mutates a payment — that only ever happens
 * inside the verified Stripe webhook. This endpoint exists purely so the
 * success page can show "processing" vs "confirmed" without the frontend
 * being able to mark a payment as paid itself.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id")?.trim();

  if (!sessionId) {
    return NextResponse.json(
      { error: "Falta session_id.", status: "unknown" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ status: "pending" });
  }

  const { data, error } = await supabase
    .from("employer_payments")
    .select("status")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.warn("Employer deposit status lookup failed.", { code: error.code });
    return NextResponse.json({ status: "unknown" });
  }

  if (!data) {
    return NextResponse.json({ status: "pending" });
  }

  return NextResponse.json({ status: data.status });
}
