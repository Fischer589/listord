import { availabilityRenewalEnabled } from "@/lib/availability";
import { NextResponse } from "next/server";
import { matchWorker, MATCH_COLUMNS, parseMatchRequest } from "@/lib/request-matching";
import { MATCH_HEADERS, readMatchBody } from "@/lib/request-match-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { requestSummary } from "@/lib/request-specification";
import { contactAccessResponse, requireWorkspaceContact } from "@/lib/workspace-contact-access";

/** Matching is free; the private handoff requires the employer's paid pass. */
export async function POST(request: Request) {
  const body = await readMatchBody(request).catch(() => null) as { draft?: unknown; workerId?: unknown } | null;
  const draft = parseMatchRequest(body?.draft);
  const id = body?.workerId;
  const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers: MATCH_HEADERS });
  if (!draft || typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return reply("Revisa tu solicitud y el perfil elegido.", 400);
  try { await requireWorkspaceContact(request); }
  catch (error) { return contactAccessResponse(error, MATCH_HEADERS); }
  try {
    const client = getSupabaseAdminClient();
    if (!client) return reply("No pudimos preparar el contacto. Intenta de nuevo.", 503);
    const { data, error } = await client.from("workers").select(`${MATCH_COLUMNS},whatsapp_number,owner_user_id`).eq("id", id).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    if (error) return reply("No pudimos preparar el contacto. Intenta de nuevo.", 503);
    let confirmedAt: string | null = null;
    const renewed = availabilityRenewalEnabled();
    if (renewed && !data?.owner_user_id) return reply("La titularidad de este perfil aún no está confirmada.", 409);
    if (renewed && data) {
      const state = await client.from("worker_availability").select("confirmed_at")
        .eq("worker_id", id).eq("available", true).gt("access_expires_at", new Date().toISOString())
        .abortSignal(AbortSignal.timeout(8000)).maybeSingle();
      if (state.error) return reply("No pudimos verificar la disponibilidad. Intenta de nuevo.", 503);
      confirmedAt = state.data?.confirmed_at ?? null;
    }
    if (!data || !matchWorker({ ...data, availability_confirmed_at: confirmedAt }, draft, new Date(), renewed ? "confirmed" : "legacy")) return reply("Este perfil ya no cumple los criterios. Actualiza los resultados.", 409);
    const url = buildWhatsAppUrl(data.whatsapp_number);
    if (!url) return reply("Este perfil no tiene un contacto disponible.", 404);
    return NextResponse.json({ url: `${url}?text=${encodeURIComponent(`Hola ${data.full_name}, vi tu perfil en ListoRD (${id}). ¿Te interesa este trabajo?\n\n${requestSummary(draft)}\n\n¿Puedes confirmar el horario, las tareas y el pago?`)}` }, { headers: MATCH_HEADERS });
  } catch { return reply("No pudimos preparar el contacto. Intenta de nuevo.", 503); }
}
