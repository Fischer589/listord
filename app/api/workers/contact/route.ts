import { NextResponse } from "next/server";
import { upsertEmployerSession } from "@/lib/employer-sessions";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const WORKER_CONTACT_MESSAGE =
  "Hola, vi tu perfil en ListoRD. ¿Estás disponible hoy para trabajar?";

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no está configurado para contactos seguros." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    workerId?: string;
    browser_session_id?: string;
    whatsapp_number?: string;
  } | null;
  const workerId = body?.workerId?.trim();
  const browserSessionId = body?.browser_session_id?.trim();
  const whatsappNumber = body?.whatsapp_number?.trim();

  if (!workerId) {
    return NextResponse.json(
      { error: "Falta workerId." },
      { status: 400 }
    );
  }

  if (!browserSessionId) {
    return NextResponse.json(
      { error: "Falta browser_session_id." },
      { status: 400 }
    );
  }

  await upsertEmployerSession({
    browserSessionId,
    whatsappNumber
  });

  const { data: accessRows, error: accessError } = await supabase.rpc(
    "claim_worker_contact",
    {
      p_browser_session_id: browserSessionId,
      p_worker_id: workerId
    }
  );

  if (accessError) {
    return NextResponse.json(
      { error: "No pudimos validar tu acceso." },
      { status: 500 }
    );
  }

  const access = Array.isArray(accessRows) ? accessRows[0] : accessRows;

  console.info("Contact API response:", {
    workerId,
    browserSessionId,
    allowed: Boolean(access?.allowed),
    reason: access?.reason ?? null,
    free_contacts_remaining: access?.free_contacts_remaining ?? null
  });

  if (!access?.allowed) {
    const isRateLimited = access?.reason === "rate_limited";

    return NextResponse.json(
      {
        error: isRateLimited
          ? "Demasiados intentos. Intenta de nuevo en un minuto."
          : "Ya usaste tus contactos gratis.",
        reason: access?.reason ?? "payment_required",
        free_contacts_remaining: access?.free_contacts_remaining ?? 0
      },
      { status: isRateLimited ? 429 : 402 }
    );
  }

  const { data, error } = await supabase
    .from("workers")
    .select("whatsapp_number")
    .eq("id", workerId)
    .eq("is_verified", true)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 404 }
    );
  }

  const phone = data.whatsapp_number?.replace(/\D/g, "");

  if (!phone) {
    return NextResponse.json(
      { error: "Este trabajador no tiene WhatsApp disponible." },
      { status: 404 }
    );
  }

  const message = encodeURIComponent(WORKER_CONTACT_MESSAGE);

  return NextResponse.json({
    url: `https://wa.me/${phone}?text=${message}`
  });
}
