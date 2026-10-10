import { NextResponse } from "next/server";
import { getPremiumAccessByCheckoutSession } from "@/lib/premium-access";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
/** A checkout reference can read minimal reconciliation status only. Signed
 * webhooks own all payment writes; returning to this URL never renews access. */
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]{20,200}$/.test(sessionId)) {
    return NextResponse.json({ error: "Referencia inválida.", premium: false }, { status: 400, headers });
  }
  try {
    const record = await getPremiumAccessByCheckoutSession(sessionId);
    return NextResponse.json({ premium: Boolean(record), plan: record?.plan ?? null, paid_access_until: record?.paid_access_until ?? null }, { headers });
  } catch {
    return NextResponse.json({ error: "El pago sigue pendiente de reconciliación. No vuelvas a pagar.", premium: false }, { status: 503, headers });
  }
}
