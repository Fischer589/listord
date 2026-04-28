import { NextResponse } from "next/server";
import { getActivePremiumAccess } from "@/lib/premium-access";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const browserSessionId = url.searchParams.get("browser_session_id")?.trim();

  if (!browserSessionId) {
    return NextResponse.json(
      { error: "Falta browser_session_id.", premium: false },
      { status: 400 }
    );
  }

  try {
    const premiumAccess = await getActivePremiumAccess(browserSessionId);

    return NextResponse.json({
      premium: Boolean(premiumAccess),
      plan: premiumAccess?.plan ?? null,
      paid_access_until: premiumAccess?.paid_access_until ?? null
    });
  } catch {
    return NextResponse.json(
      {
        error: "No pudimos verificar tu acceso todavía. Intenta de nuevo.",
        premium: false
      },
      { status: 500 }
    );
  }
}
