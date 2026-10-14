import { NextResponse } from "next/server";
import { verifiedMarketplaceUser } from "@/lib/marketplace-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isUuid, workspaceEnabled, workspaceSessionPattern, workspaceSessionPrefix } from "@/lib/employer-workspace";
import { readJsonBody } from "@/lib/http-json";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { contactAccessResponse, requireWorkspaceContact } from "@/lib/workspace-contact-access";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const failure = (status = 503, error = "No se pudo completar la operación.") => NextResponse.json({ error }, { status, headers });

async function context(request: Request) {
  if (!workspaceEnabled()) throw { status: 503 };
  const ownerId = await verifiedMarketplaceUser(request);
  const db = getSupabaseAdminClient();
  const sessionPrefix = workspaceSessionPrefix();
  if (!db || !sessionPrefix) throw { status: 503 };
  const { data: orders, error } = await db.from("employer_workspace_orders")
    .select("access_until").eq("owner_user_id", ownerId).eq("status", "paid")
    .gt("access_until", new Date().toISOString()).like("stripe_session_id", workspaceSessionPattern(sessionPrefix))
    .order("access_until", { ascending: false }).limit(1);
  if (error) throw { status: 503 };
  return { ownerId, db, accessUntil: orders?.[0]?.access_until ?? null };
}

function responseError(error: unknown) {
  const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 503;
  return failure(status === 401 ? 401 : 503, status === 401 ? "Verifica tu correo." : "Servicio no disponible.");
}

export async function GET(request: Request) {
  try {
    const { ownerId, db, accessUntil } = await context(request);
    if (!accessUntil) return NextResponse.json({ active: false, accessUntil: null, candidates: [], requests: [], contacts: [] }, { headers });
    const [candidateResult, requestResult, contactResult] = await Promise.all([
      db.from("employer_workspace_candidates").select("worker_id,created_at").eq("owner_user_id", ownerId).order("created_at", { ascending: false }).limit(500),
      db.from("employer_workspace_requests").select("id,title,details,status,created_at").eq("owner_user_id", ownerId).order("created_at", { ascending: false }).limit(500),
      db.from("employer_workspace_contacts").select("id,worker_id,request_id,created_at").eq("owner_user_id", ownerId).order("created_at", { ascending: false }).limit(500)
    ]);
    if (candidateResult.error || requestResult.error || contactResult.error) return failure();
    const ids = Array.from(new Set([
      ...(candidateResult.data ?? []).map(row => row.worker_id),
      ...(contactResult.data ?? []).map(row => row.worker_id)
    ]));
    const workersResult = ids.length ? await db.from("workers")
      .select("id,full_name,city,skills").in("id", ids).eq("is_verified", true) : { data: [], error: null };
    if (workersResult.error) return failure();
    const byId = new Map((workersResult.data ?? []).map(worker => [worker.id, worker]));
    const candidates = (candidateResult.data ?? []).flatMap(row => {
      const worker = byId.get(row.worker_id);
      return worker ? [{ ...worker, savedAt: row.created_at }] : [];
    });
    return NextResponse.json({ active: true, accessUntil, candidates,
      requests: requestResult.data ?? [], contacts: (contactResult.data ?? []).map(row => ({
        ...row, worker_name: byId.get(row.worker_id)?.full_name ?? null
      })) }, { headers });
  } catch (error) { return responseError(error); }
}

export async function POST(request: Request) {
  try {
    const { ownerId, db, accessUntil } = await context(request);
    const body = await readJsonBody(request, 4096).catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.action !== "string") return failure(400, "Solicitud no válida.");
    if (!accessUntil && body.action !== "prepare_contact") return failure(403, "Activa tu espacio de empleador para guardar información.");
    if (body.action === "save_candidate" || body.action === "remove_candidate" || body.action === "prepare_contact") {
      if (!isUuid(body.workerId)) return failure(400, "Trabajador no válido.");
      const workerId = body.workerId;
      if (body.action === "prepare_contact") {
        try { await requireWorkspaceContact(request, workerId); }
        catch (error) { return contactAccessResponse(error, headers); }
      }
      if (body.action === "remove_candidate") {
        const { error } = await db.from("employer_workspace_candidates").delete()
          .eq("owner_user_id", ownerId).eq("worker_id", workerId);
        return error ? failure() : NextResponse.json({ ok: true }, { headers });
      }
      const { data: worker, error: workerError } = await db.from("workers")
        .select("id,full_name,whatsapp_number").eq("id", workerId).eq("is_verified", true).maybeSingle();
      if (workerError) return failure();
      if (!worker) return failure(404, "Este perfil ya no está disponible.");
      if (body.action === "save_candidate") {
        const { error } = await db.from("employer_workspace_candidates")
          .upsert({ owner_user_id: ownerId, worker_id: workerId }, { onConflict: "owner_user_id,worker_id", ignoreDuplicates: true });
        return error ? failure() : NextResponse.json({ ok: true }, { headers });
      }
      const requestId = body.requestId === null || body.requestId === undefined ? null : body.requestId;
      let title = "";
      if (requestId !== null) {
        if (!isUuid(requestId)) return failure(400, "Solicitud no válida.");
        const { data: staffing, error } = await db.from("employer_workspace_requests")
          .select("title").eq("id", requestId).eq("owner_user_id", ownerId).maybeSingle();
        if (error) return failure();
        if (!staffing) return failure(404, "Solicitud no encontrada.");
        title = staffing.title;
      }
      const url = buildWhatsAppUrl(worker.whatsapp_number);
      if (!url) return failure(404, "Este contacto no está disponible.");
      const { data: log, error: logError } = await db.from("employer_workspace_contacts")
        .insert({ owner_user_id: ownerId, worker_id: workerId, request_id: requestId }).select("id").single();
      if (logError || !log?.id) return failure();
      const message = `Hola ${worker.full_name?.trim() || ""}, vi tu perfil en ListoRD (${workerId}).${title ? ` Te contacto por mi solicitud: ${title}.` : ""} ¿Podemos hablar de tareas, horario y pago?`;
      return NextResponse.json({ url: `${url}?text=${encodeURIComponent(message)}` }, { headers });
    }
    if (body.action === "add_request") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const details = typeof body.details === "string" ? body.details.trim() : "";
      if (title.length < 3 || title.length > 120 || details.length > 1200) return failure(400, "Revisa el título y los detalles.");
      const { data, error } = await db.from("employer_workspace_requests")
        .insert({ owner_user_id: ownerId, title, details }).select("id").single();
      return error || !data?.id ? failure() : NextResponse.json({ ok: true }, { headers });
    }
    if (body.action === "set_request_status") {
      if (!isUuid(body.requestId) || (body.status !== "open" && body.status !== "closed")) return failure(400, "Solicitud no válida.");
      const { data, error } = await db.from("employer_workspace_requests")
        .update({ status: body.status }).eq("id", body.requestId).eq("owner_user_id", ownerId).select("id").maybeSingle();
      return error ? failure() : !data ? failure(404, "Solicitud no encontrada.") : NextResponse.json({ ok: true }, { headers });
    }
    return failure(400, "Operación no válida.");
  } catch (error) { return responseError(error); }
}
