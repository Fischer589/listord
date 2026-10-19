import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/http-json";
import { isFreshAvailability } from "@/lib/availability";
import { MarketplaceError, marketplaceAdmin, verifiedMarketplaceUser } from "@/lib/marketplace-server";
import { uuid } from "@/lib/marketplace";

const headers = { "Cache-Control": "private, no-store" };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
function failure(error: unknown) {
  return reply({ error: error instanceof MarketplaceError && error.status === 401
    ? "Verifica tu cuenta para administrar tu perfil."
    : "No se pudo confirmar el cambio. Intenta de nuevo." },
  error instanceof MarketplaceError ? error.status : 503);
}

/** Only a previously linked, freshly verified Auth account may self-confirm. */
export async function GET(request: Request) {
  try {
    const actor = await verifiedMarketplaceUser(request);
    const db = marketplaceAdmin();
    const workers = await db.from("workers").select("id,is_verified")
      .eq("owner_user_id", actor).order("id").limit(50).abortSignal(AbortSignal.timeout(8000));
    if (workers.error || !workers.data) throw new Error("unavailable");
    if (!workers.data.length) return reply({ profiles: [], recoveryRequired: true });
    const ids = workers.data.map(row => row.id);
    const [availability, consent, queue] = await Promise.all([
      db.from("worker_availability").select("worker_id,available,confirmed_at,access_expires_at")
        .in("worker_id", ids).abortSignal(AbortSignal.timeout(8000)),
      db.from("worker_notification_consent").select("worker_id,channel,revoked_at")
        .in("worker_id", ids).eq("owner_user_id", actor).abortSignal(AbortSignal.timeout(8000)),
      db.from("worker_activation_queue").select("worker_id,opted_out_at")
        .in("worker_id", ids).abortSignal(AbortSignal.timeout(8000))
    ]);
    if (availability.error || consent.error || queue.error) throw new Error("unavailable");
    const now = new Date();
    return reply({ recoveryRequired: false, profiles: workers.data.map(worker => {
      const state = availability.data?.find(row => row.worker_id === worker.id);
      const current = Boolean(worker.is_verified && state && Date.parse(state.access_expires_at) > now.getTime() &&
        isFreshAvailability(state.available, state.confirmed_at, now));
      return { id: worker.id, approved: worker.is_verified, available: current,
        confirmedAt: state?.confirmed_at ?? null,
        notifications: {
          whatsapp: Boolean(consent.data?.some(row => row.worker_id === worker.id && row.channel === "whatsapp" && !row.revoked_at))
        },
        activationOptedOut: Boolean(queue.data?.some(row => row.worker_id === worker.id && row.opted_out_at)) };
    }) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const body = await readJsonBody(request, 512).catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Solicitud inválida." }, 400);
  const input = body as Record<string, unknown>;
  if (!uuid(input.workerId)) return reply({ error: "Solicitud inválida." }, 400);
  try {
    const actor = await verifiedMarketplaceUser(request);
    const db = marketplaceAdmin();
    if (input.action === "availability" && typeof input.available === "boolean") {
      const { data, error } = await db.rpc("worker_activation_confirm",
        { p_actor: actor, p_worker: input.workerId, p_available: input.available })
        .abortSignal(AbortSignal.timeout(8000));
      if (error) throw new Error("unavailable");
      if (!data?.length) return reply({ error: "Este perfil requiere verificar su titularidad y aprobación." }, 403);
      return reply({ saved: true, available: data[0].available,
        confirmedAt: data[0].confirmed_at, fresh: isFreshAvailability(data[0].available, data[0].confirmed_at) });
    }
    if (input.action === "notification_consent" && input.channel === "whatsapp" &&
        typeof input.agree === "boolean") {
      const { error } = await db.rpc("worker_activation_notification_consent",
        { p_actor: actor, p_worker: input.workerId, p_channel: input.channel, p_agree: input.agree })
        .abortSignal(AbortSignal.timeout(8000));
      if (error) return reply({ error: "No se pudo actualizar el permiso para mensajes." }, 403);
      return reply({ saved: true });
    }
    if (input.action === "invitation_opt_out" && input.optOut === true) {
      const { error } = await db.rpc("worker_activation_self_opt_out",
        { p_actor: actor, p_worker: input.workerId })
        .abortSignal(AbortSignal.timeout(8000));
      if (error) return reply({ error: "No puedes administrar este perfil." }, 403);
      return reply({ saved: true });
    }
    return reply({ error: "Solicitud inválida." }, 400);
  } catch (error) { return failure(error); }
}
