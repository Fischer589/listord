import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildWorkerContactWhatsAppUrl } from "@/lib/whatsapp";
import { readJsonBody } from "@/lib/http-json";
import { parseMatchRequest } from "@/lib/request-matching";
import { contactAccessResponse, preflightWorkerContact, recordAuthorizedHandoff, requireWorkspaceContact } from "@/lib/workspace-contact-access";

const headers = { "Cache-Control": "private, no-store" };

/** Discovery is free; the private handoff requires the employer's paid pass. */
export async function POST(request: Request) {
  const body = await readJsonBody(request, 4096).catch(() => null) as { workerId?: unknown; draft?: unknown } | null;
  if (typeof body?.workerId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.workerId)) {
    return NextResponse.json({ error: "No pudimos preparar el contacto." }, { status: 400, headers });
  }
  const draft = body.draft === undefined ? null : parseMatchRequest(body.draft);
  if (body.draft !== undefined && !draft) return NextResponse.json({ error: "Revisa los detalles de tu solicitud." }, { status: 400, headers });
  try { await preflightWorkerContact(request, body.workerId); }
  catch (error) { return contactAccessResponse(error, headers); }
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error("unavailable");
    const { data, error } = await supabase.from("workers").select("full_name,whatsapp_number")
      .eq("id", body.workerId).eq("is_verified", true)
      .abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    if (error) throw new Error("unavailable");
    const url = data && buildWorkerContactWhatsAppUrl(data.whatsapp_number, data.full_name);
    if (!url) return NextResponse.json({ error: "Este contacto no está disponible." }, { status: 404, headers });
    let access: Awaited<ReturnType<typeof requireWorkspaceContact>>;
    try { access = await requireWorkspaceContact(request, body.workerId); }
    catch (error) { return contactAccessResponse(error, headers); }
    await recordAuthorizedHandoff(access, "worker");
    return NextResponse.json({ url }, { headers });
  } catch {
    return NextResponse.json({ error: "No pudimos abrir WhatsApp ahora mismo. Intenta de nuevo." }, { status: 503, headers });
  }
}
