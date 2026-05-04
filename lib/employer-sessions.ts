import { getSupabaseAdminClient } from "./supabase-admin";
import { normalizeWhatsAppNumber } from "./whatsapp";

export async function upsertEmployerSession({
  browserSessionId,
  whatsappNumber
}: {
  browserSessionId?: string | null;
  whatsappNumber?: string | null;
}) {
  const normalizedSessionId = browserSessionId?.trim();

  if (!normalizedSessionId) {
    return;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const normalizedWhatsAppNumber = normalizeWhatsAppNumber(whatsappNumber);
  const payload: {
    browser_session_id: string;
    updated_at: string;
    whatsapp_number?: string;
  } = {
    browser_session_id: normalizedSessionId,
    updated_at: new Date().toISOString()
  };

  if (normalizedWhatsAppNumber) {
    payload.whatsapp_number = normalizedWhatsAppNumber;
  }

  const { error } = await supabase
    .from("employer_sessions")
    .upsert(payload, { onConflict: "browser_session_id" });

  if (error) {
    console.warn("Employer session tracking failed.", {
      code: error.code
    });
  }
}
