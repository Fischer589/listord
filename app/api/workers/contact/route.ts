import { NextResponse } from "next/server";
import { upsertEmployerSession } from "@/lib/employer-sessions";
import { getActivePremiumAccess } from "@/lib/premium-access";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const FREE_CONTACTS_PER_DAY = 1;

function getTodayStartIso() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();
}

function logContactAccessDecision({
  workerId,
  browserSessionId,
  freeContactCount,
  premium,
  paywallTriggered,
  workerUrlReturned,
  reason
}: {
  workerId: string;
  browserSessionId: string;
  freeContactCount: number;
  premium: boolean;
  paywallTriggered: boolean;
  workerUrlReturned: boolean;
  reason: string;
}) {
  console.info("Contact API paywall decision:", {
    workerId,
    browserSessionId,
    free_contact_count: freeContactCount,
    premium,
    paywall_triggered: paywallTriggered,
    worker_url_returned: workerUrlReturned,
    reason
  });
}

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

  const { data, error } = await supabase
    .from("workers")
    .select("whatsapp_number, is_verified")
    .eq("id", workerId)
    .maybeSingle();

  console.info("Contact API worker lookup:", {
    workerId,
    worker_found: Boolean(data),
    has_whatsapp_number: Boolean(data?.whatsapp_number?.trim()),
    is_verified: data?.is_verified ?? null
  });

  if (error) {
    logContactAccessDecision({
      workerId,
      browserSessionId,
      freeContactCount: 0,
      premium: false,
      paywallTriggered: false,
      workerUrlReturned: false,
      reason: "worker_lookup_error"
    });

    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 500 }
    );
  }

  if (!data) {
    logContactAccessDecision({
      workerId,
      browserSessionId,
      freeContactCount: 0,
      premium: false,
      paywallTriggered: false,
      workerUrlReturned: false,
      reason: "worker_not_found"
    });

    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 404 }
    );
  }

  const url = buildWhatsAppUrl(data.whatsapp_number);

  if (!data.is_verified) {
    logContactAccessDecision({
      workerId,
      browserSessionId,
      freeContactCount: 0,
      premium: false,
      paywallTriggered: false,
      workerUrlReturned: false,
      reason: "worker_not_verified"
    });

    return NextResponse.json(
      { error: "Este trabajador todavía no está aprobado." },
      { status: 403 }
    );
  }

  if (!url) {
    logContactAccessDecision({
      workerId,
      browserSessionId,
      freeContactCount: 0,
      premium: false,
      paywallTriggered: false,
      workerUrlReturned: false,
      reason: "missing_whatsapp_url"
    });

    return NextResponse.json(
      { error: "Este trabajador no tiene WhatsApp disponible." },
      { status: 404 }
    );
  }

  const premiumAccess = await getActivePremiumAccess(browserSessionId).catch(
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
    logContactAccessDecision({
      workerId,
      browserSessionId,
      freeContactCount: 0,
      premium: isPremium,
      paywallTriggered: false,
      workerUrlReturned: false,
      reason: "contact_count_error"
    });

    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 500 }
    );
  }

  const freeContactCount = dailyContactCount ?? 0;

  if (!isPremium && freeContactCount >= FREE_CONTACTS_PER_DAY) {
    logContactAccessDecision({
      workerId,
      browserSessionId,
      freeContactCount,
      premium: false,
      paywallTriggered: true,
      workerUrlReturned: false,
      reason: "paywall_required"
    });

    return NextResponse.json(
      {
        error: "Ya usaste tu contacto gratis de hoy.",
        reason: "paywall_required",
        free_contacts_remaining: 0
      },
      { status: 402 }
    );
  }

  const { error: attemptError } = await supabase
    .from("contact_attempts")
    .insert({
      browser_session_id: browserSessionId,
      worker_id: workerId
    });

  if (attemptError) {
    logContactAccessDecision({
      workerId,
      browserSessionId,
      freeContactCount,
      premium: isPremium,
      paywallTriggered: false,
      workerUrlReturned: false,
      reason: "contact_attempt_insert_error"
    });

    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 500 }
    );
  }

  logContactAccessDecision({
    workerId,
    browserSessionId,
    freeContactCount: isPremium ? freeContactCount : freeContactCount + 1,
    premium: isPremium,
    paywallTriggered: false,
    workerUrlReturned: true,
    reason: isPremium ? "premium" : "free_contact"
  });

  return NextResponse.json({
    url,
    reason: isPremium ? "premium" : "free_contact",
    free_contacts_remaining: isPremium
      ? null
      : Math.max(0, FREE_CONTACTS_PER_DAY - freeContactCount - 1)
  });
}
