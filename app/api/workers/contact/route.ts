import { NextResponse } from "next/server";
import { upsertEmployerSession } from "@/lib/employer-sessions";
import { getActivePremiumAccess } from "@/lib/premium-access";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from "@/lib/whatsapp";

const FREE_CONTACTS_PER_DAY = 1;

function getTodayStartIso() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "No pudimos abrir WhatsApp ahora mismo. Intenta de nuevo." },
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
  const whatsappNumber = normalizeWhatsAppNumber(body?.whatsapp_number);

  if (!workerId) {
    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 400 }
    );
  }

  if (!browserSessionId) {
    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
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

  if (error) {
    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 404 }
    );
  }

  const url = buildWhatsAppUrl(data.whatsapp_number);

  if (!data.is_verified) {
    return NextResponse.json(
      { error: "Este trabajador todavía no está aprobado." },
      { status: 403 }
    );
  }

  if (!url) {
    return NextResponse.json(
      { error: "Este trabajador no tiene WhatsApp disponible." },
      { status: 404 }
    );
  }

  const premiumAccess = await getActivePremiumAccess({
    browserSessionId,
    whatsappNumber
  }).catch(
    (premiumError) => {
      console.warn("Contact API premium lookup failed.", {
        workerId,
        browserSessionId,
        message:
          premiumError instanceof Error
            ? premiumError.message
            : String(premiumError)
      });
      return null;
    }
  );
  const isPremium = Boolean(premiumAccess);

  const todayStartIso = getTodayStartIso();
  const { count: dailyContactCount, error: countError } = await supabase
    .from("contact_attempts")
    .select("id", { count: "exact", head: true })
    .eq("browser_session_id", browserSessionId)
    .gte("created_at", todayStartIso);

  if (countError) {
    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 500 }
    );
  }

  const freeContactCount = dailyContactCount ?? 0;

  if (!isPremium && freeContactCount >= FREE_CONTACTS_PER_DAY) {
    return NextResponse.json(
      {
        error: "Ya usaste tu contacto gratis de hoy.",
        reason: "paywall_required",
        free_contacts_remaining: 0
      },
      { status: 402 }
    );
  }

  if (isPremium) {
    return NextResponse.json({
      url,
      reason: "premium",
      free_contacts_remaining: null
    });
  }

  const { error: attemptError } = await supabase
    .from("contact_attempts")
    .insert({
      browser_session_id: browserSessionId,
      worker_id: workerId
    });

  if (attemptError) {
    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    url,
    reason: "free_contact",
    free_contacts_remaining: Math.max(
      0,
      FREE_CONTACTS_PER_DAY - freeContactCount - 1
    )
  });
}
