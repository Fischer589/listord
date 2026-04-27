import { NextResponse } from "next/server";
import { getPremiumAccessByCheckoutSession } from "@/lib/premium-access";

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
    const premiumAccess = await getPremiumAccessByCheckoutSession(
      sessionId,
      browserSessionId
    );

    return NextResponse.json({
      premium: Boolean(premiumAccess),
      plan: premiumAccess?.plan ?? null,
      paid_access_until: premiumAccess?.paid_access_until ?? null
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo verificar el acceso.";

    return NextResponse.json(
      { error: message, premium: false },
      { status: 500 }
    );
  }
}
