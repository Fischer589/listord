import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/http-json";
import { MARKETPLACE_HEADERS as headers, marketplaceEnabled, object, uuid } from "@/lib/marketplace";
import { MarketplaceError, marketplaceAdmin, rpcFailure } from "@/lib/marketplace-server";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { contactAccessResponse, requireWorkspaceContact } from "@/lib/workspace-contact-access";
export async function POST(request: Request) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Deshabilitado." }, { status: 503, headers });
  const b = object(await readJsonBody(request, 1024).catch(() => null));
  if (!uuid(b?.id) || !uuid(b.workerId)) return NextResponse.json({ error: "Selecciona un trabajador válido." }, { status: 400, headers });
  try {
    let actor: string;
    try { actor = (await requireWorkspaceContact(request, b.workerId)).ownerId; }
    catch (error) { return contactAccessResponse(error, headers); }
    const admin = marketplaceAdmin();
    const listing = await admin.from("marketplace_opportunities").select("id")
      .eq("id", b.id).is("deleted_at", null).eq("status", "open").eq("moderation_status", "approved")
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    if (listing.error) throw listing.error;
    if (!listing.data) return NextResponse.json({ error: "La oportunidad ya no está disponible." }, { status: 404, headers });
    const { data: owner, error: ownerError } = await admin.from("marketplace_opportunity_owners")
      .select("opportunity_id").eq("opportunity_id", b.id).eq("owner_user_id", actor)
      .abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    if (ownerError) throw ownerError;
    if (!owner) return NextResponse.json({ error: "Solo el empleador puede elegir a quién contactar." }, { status: 403, headers });
    const { data, error } = await admin.rpc("marketplace_contacts_v2", { p_actor: actor, p_id: b.id, p_worker: b.workerId }).abortSignal(AbortSignal.timeout(8000));
    rpcFailure(error);
    const contacts = (data as { name: string; phone: string; worker_id: string; worker_name: string }[]).filter(c => c.worker_id === b.workerId).flatMap(c => {
      const url = buildWhatsAppUrl(c.phone);
      if (!url || !uuid(c.worker_id)) return [];
      const workerName = c.worker_name?.trim().slice(0, 100) || "trabajador";
      const text = `Hola, te escribo sobre la oportunidad de ListoRD ${b.id} y el perfil de ${workerName} (${c.worker_id}). ¿Podemos confirmar las tareas, horario y pago?`;
      return [{ name: c.name, workerId: c.worker_id, url: `${url}?text=${encodeURIComponent(text)}` }];
    });
    return NextResponse.json({ contacts }, { headers });
  } catch (e) { return NextResponse.json({ error: e instanceof MarketplaceError ? e.message : "No se pudo abrir el contacto." }, { status: e instanceof MarketplaceError ? e.status : 503, headers }); }
}
