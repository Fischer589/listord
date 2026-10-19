import { NextResponse } from "next/server";
import { matchWorker, MATCH_COLUMNS, parseMatchRequest } from "@/lib/request-matching";
import { MATCH_HEADERS, readMatchBody } from "@/lib/request-match-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildWorkerContactWhatsAppUrl } from "@/lib/whatsapp";
import { contactAccessResponse, preflightWorkerContact, recordAuthorizedHandoff, requireWorkspaceContact } from "@/lib/workspace-contact-access";

/** Matching is free; the private handoff requires the employer's paid pass. */
export async function POST(request: Request) {
  const body = await readMatchBody(request).catch(() => null) as { draft?: unknown; workerId?: unknown } | null;
  const draft = parseMatchRequest(body?.draft);
  const id = body?.workerId;
  const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers: MATCH_HEADERS });
  if (!draft || typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return reply("Revisa tu solicitud y el perfil elegido.", 400);
  try { await preflightWorkerContact(request, id); }
  catch (error) { return contactAccessResponse(error, MATCH_HEADERS); }
  try {
    const client = getSupabaseAdminClient();
    if (!client) return reply("No pudimos preparar el contacto. Intenta de nuevo.", 503);
    const { data, error } = await client.from("workers").select(`${MATCH_COLUMNS},whatsapp_number,owner_user_id`).eq("id", id).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    if (error) return reply("No pudimos preparar el contacto. Intenta de nuevo.", 503);
    let confirmedAt: string | null = null;
    if (!data?.owner_user_id) return reply("La titularidad de este perfil aún no está confirmada.", 409);
    if (data) {
      const state = await client.from("worker_availability").select("confirmed_at")
        .eq("worker_id", id).eq("available", true).gt("access_expires_at", new Date().toISOString())
        .abortSignal(AbortSignal.timeout(8000)).maybeSingle();
      if (state.error) return reply("No pudimos verificar la disponibilidad. Intenta de nuevo.", 503);
      confirmedAt = state.data?.confirmed_at ?? null;
    }
    if (!matchWorker({ ...data, availability_confirmed_at: confirmedAt }, draft, new Date(), "confirmed")) return reply("Este perfil ya no cumple los criterios. Actualiza los resultados.", 409);
    const url = buildWorkerContactWhatsAppUrl(data.whatsapp_number, data.full_name);
    if (!url) return reply("Este perfil no tiene un contacto disponible.", 404);
    let access: Awaited<ReturnType<typeof requireWorkspaceContact>>;
    try { access = await requireWorkspaceContact(request, id); }
    catch (error) { return contactAccessResponse(error, MATCH_HEADERS); }
    await recordAuthorizedHandoff(access, "request");
    return NextResponse.json({ url }, { headers: MATCH_HEADERS });
  } catch { return reply("No pudimos preparar el contacto. Intenta de nuevo.", 503); }
}
