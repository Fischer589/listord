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
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo verificar el acceso premium.";

    return NextResponse.json(
      { error: message, premium: false },
      { status: 500 }
    );
  }
}
