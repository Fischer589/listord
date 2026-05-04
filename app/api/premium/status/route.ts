import { NextResponse } from "next/server";
import { getActivePremiumAccess } from "@/lib/premium-access";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const browserSessionId = url.searchParams.get("browser_session_id")?.trim();
  const whatsappNumber = url.searchParams.get("whatsapp_number")?.trim();

  if (!browserSessionId && !whatsappNumber) {
    return NextResponse.json(
      { error: "Falta browser_session_id o whatsapp_number.", premium: false },
      { status: 400 }
    );
  }

  try {
    const premiumAccess = await getActivePremiumAccess({
      browserSessionId,
      whatsappNumber
    });

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
