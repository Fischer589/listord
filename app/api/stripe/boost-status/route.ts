import { NextResponse } from "next/server";
import { getBoostBySessionId } from "@/lib/boost-data";

/**
 * READ-ONLY. Never activates or mutates a boost — that only ever happens
 * inside the verified Stripe webhook. This endpoint exists purely so the
 * success page can show "processing" vs "confirmed" without the frontend
 * being able to trigger activation itself.
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

  const boost = await getBoostBySessionId(sessionId);

  if (!boost) {
    return NextResponse.json({ status: "pending" });
  }

  return NextResponse.json({
    status: boost.payment_status,
    boost_expires_at: boost.boost_expires_at
  });
}
