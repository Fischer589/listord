import { NextResponse } from "next/server";
import { upsertEmployerSession } from "@/lib/employer-sessions";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

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

  console.info("Contact API workerId received:", {
    workerId: workerId || null
  });

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

  const { data, error } = await supabase
    .from("workers")
    .select("whatsapp_number, is_verified")
    .eq("id", workerId)
    .maybeSingle();

  console.info("Contact API worker lookup:", {
    workerId,
    worker_found: Boolean(data),
    raw_whatsapp_number: data?.whatsapp_number ?? null,
    is_verified: data?.is_verified ?? null
  });

  if (error) {
    console.info("Contact API access decision:", {
      workerId,
      allowed: false,
      blocked: true,
      reason: "worker_lookup_error"
    });

    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 500 }
    );
  }

  if (!data) {
    console.info("Contact API normalized WhatsApp URL:", {
      workerId,
      url: null
    });
    console.info("Contact API access decision:", {
      workerId,
      allowed: false,
      blocked: true,
      reason: "worker_not_found"
    });

    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 404 }
    );
  }

  const url = buildWhatsAppUrl(data.whatsapp_number);

  console.info("Contact API normalized WhatsApp URL:", {
    workerId,
    raw_whatsapp_number: data.whatsapp_number,
    url
  });

  if (!data.is_verified) {
    console.info("Contact API access decision:", {
      workerId,
      allowed: false,
      blocked: true,
      reason: "worker_not_verified"
    });

    return NextResponse.json(
      { error: "Este trabajador todavía no está aprobado." },
      { status: 403 }
    );
  }

  if (!url) {
    console.info("Contact API access decision:", {
      workerId,
      allowed: false,
      blocked: true,
      reason: "missing_whatsapp_url"
    });

    return NextResponse.json(
      { error: "Este trabajador no tiene WhatsApp disponible." },
      { status: 404 }
    );
  }

  console.info("Contact API access decision:", {
    workerId,
    allowed: true,
    blocked: false,
    reason: "temporary_verified_worker_bypass"
  });

  return NextResponse.json({
    url
  });
}
