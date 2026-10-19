import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { readJsonBody } from "@/lib/http-json";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { uuid } from "@/lib/marketplace";
import { buildActivationQueue, type CampaignAvailability, type CampaignDelivery,
  type CampaignNotificationConsent, type CampaignQueueRecord, type CampaignWorker } from "@/lib/activation-campaign";

const headers = { "Cache-Control": "private, no-store" };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const pageSize = 500;
const maxProfiles = 10000;

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
async function allRows(db: AdminClient, table: string, columns: string, order: string, max: number) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await db.from(table).select(columns, { count: "exact" }).order(order)
      .range(offset, offset + pageSize - 1).abortSignal(AbortSignal.timeout(8000));
    if (result.error || result.count === null || result.count > max || !result.data ||
        result.data.length !== Math.min(pageSize, Math.max(result.count - offset, 0))) throw new Error("incomplete audit");
    rows.push(...result.data as unknown as Record<string, unknown>[]);
    if (rows.length === result.count) return rows;
  }
}

/** Private, exact inventory. The response contains IDs and channel flags, never numbers. */
export async function GET() {
  await requireAdmin();
  const db = getSupabaseAdminClient();
  if (!db) return reply({ error: "Auditoría no disponible." }, 503);
  try {
    const [workers, queue, availability, consent, deliveries, batches] = await Promise.all([
      allRows(db, "workers", "id,is_verified,owner_user_id,whatsapp_number,available_now", "id", maxProfiles),
      allRows(db, "worker_activation_queue", "worker_id,invitation_permission_at,invitation_channel,suppressed_at,opted_out_at,unreachable_at", "worker_id", maxProfiles),
      allRows(db, "worker_availability", "worker_id,available,confirmed_at,access_expires_at", "worker_id", maxProfiles),
      allRows(db, "worker_notification_consent", "worker_id,channel,revoked_at", "worker_id", maxProfiles * 2),
      allRows(db, "worker_activation_batch_recipients", "worker_id,status", "worker_id", maxProfiles),
      db.from("worker_activation_batches").select("id,status,channel,max_recipients,cost_ceiling_cents,created_at")
        .order("created_at", { ascending: false }).limit(50).abortSignal(AbortSignal.timeout(8000))
    ]);
    if (batches.error || queue.length !== workers.length || new Set(queue.map(row => row.worker_id)).size !== workers.length)
      throw new Error("incomplete queue");
    return reply({ ...buildActivationQueue(workers as CampaignWorker[], queue as CampaignQueueRecord[],
      availability as CampaignAvailability[], consent as CampaignNotificationConsent[],
      deliveries as CampaignDelivery[]), batches: batches.data ?? [] });
  } catch { return reply({ error: "No se pudo completar la auditoría de todos los perfiles." }, 503); }
}

export async function POST(request: Request) {
  await requireAdmin();
  const body = await readJsonBody(request, 2048).catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Solicitud inválida." }, 400);
  const input = body as Record<string, unknown>;
  const db = getSupabaseAdminClient();
  if (!db) return reply({ error: "Cola no disponible." }, 503);
  try {
    if (input.action === "permission" && uuid(input.workerId) &&
      input.channel === "whatsapp" && input.evidenceVerified === true &&
      typeof input.evidence === "string" && /^[A-Za-z0-9:_-]{5,160}$/.test(input.evidence)) {
      const result = await db.rpc("worker_activation_record_permission", {
        p_worker: input.workerId, p_channel: input.channel, p_evidence: input.evidence
      }).abortSignal(AbortSignal.timeout(8000));
      if (result.error) return reply({ error: "No se registró el permiso." }, 409);
      return reply({ saved: true });
    }
    if (input.action === "suppress" && uuid(input.workerId) &&
      ["worker_request","invalid_contact","provider_failure","dispute","operator_hold"].includes(String(input.reason))) {
      const result = await db.rpc("worker_activation_suppress",
        { p_worker: input.workerId, p_reason: input.reason }).abortSignal(AbortSignal.timeout(8000));
      if (result.error) throw new Error("unavailable");
      return reply({ saved: true });
    }
    if (input.action === "prepare_batch" && Array.isArray(input.workerIds) &&
      input.workerIds.length >= 1 && input.workerIds.length <= 10 &&
      input.workerIds.every(uuid) && new Set(input.workerIds).size === input.workerIds.length &&
      input.channel === "whatsapp" &&
      Number.isInteger(input.costCeilingCents) && Number(input.costCeilingCents) >= 0 &&
      Number(input.costCeilingCents) <= 1000000) {
      const result = await db.rpc("worker_activation_prepare_batch", {
        p_workers: input.workerIds, p_channel: input.channel, p_cost_ceiling: input.costCeilingCents
      }).abortSignal(AbortSignal.timeout(8000));
      if (result.error || !result.data) return reply({ error: "El lote contiene perfiles sin permiso, duplicados o bloqueados." }, 409);
      return reply({ batchId: result.data, status: "review", dispatchEnabled: false });
    }
    return reply({ error: "Solicitud inválida." }, 400);
  } catch { return reply({ error: "No se confirmó el cambio." }, 503); }
}
