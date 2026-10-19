import { verifiedMarketplaceUser } from "./marketplace-server";
import { getSupabaseAdminClient } from "./supabase-admin";
import { workspaceSessionPrefix } from "./employer-workspace";

export class ContactAccessError extends Error {
  constructor(public status: number) { super(status === 429 ? "Espera antes de abrir más contactos." : status === 402 ? "Necesitas créditos para desbloquear este contacto." : "Verifica tu cuenta para contactar trabajadores."); }
}

type CreditAccess = { allowed: boolean; source: string; source_order: string | null;
  remaining: number; already_unlocked: boolean };

async function access(request: Request, workerId: string, reveal: boolean) {
  let ownerId: string;
  try { ownerId = await verifiedMarketplaceUser(request); }
  catch { throw new ContactAccessError(401); }
  const db = getSupabaseAdminClient();
  const sessionPrefix = workspaceSessionPrefix();
  if (!db || !sessionPrefix) throw new ContactAccessError(503);
  const { data, error } = await db.rpc("authorize_worker_contact", {
    p_owner: ownerId, p_worker: workerId, p_prefix: sessionPrefix, p_reveal: reveal,
  }).abortSignal(AbortSignal.timeout(8000));
  if (error || !Array.isArray(data) || data.length !== 1) throw new ContactAccessError(503);
  return { ownerId, db, result: data[0] as CreditAccess };
}

/** A reveal spends one credit atomically in Postgres. */
export async function requireWorkspaceContact(request: Request, workerId: string) {
  const { ownerId, db, result } = await access(request, workerId, true);
  if (!result.allowed) throw new ContactAccessError(result.source === "rate_limited" ? 429 : result.source === "unavailable" ? 404 : 402);
  if (!result.source_order || !["credit", "direct", "workspace", "legacy"].includes(result.source)) throw new ContactAccessError(503);
  return { ownerId, db, product: result.source as "credit" | "direct" | "workspace" | "legacy",
    orderId: result.source_order, remaining: result.remaining, alreadyUnlocked: result.already_unlocked };
}

/** A status probe never spends a credit. */
export async function contactCreditStatus(request: Request, workerId: string) {
  const { db, result } = await access(request, workerId, false);
  return { db, active: result.allowed, remaining: result.remaining,
    alreadyUnlocked: result.already_unlocked, canUnlock: result.source === "credit_available",
    unavailable: result.source === "unavailable" };
}

/** Fail unpaid requests before reading the worker's private phone. */
export async function preflightWorkerContact(request: Request, workerId: string) {
  const status = await contactCreditStatus(request, workerId);
  if (status.unavailable) throw new ContactAccessError(404);
  if (!status.active && !status.canUnlock) throw new ContactAccessError(402);
  return status;
}

export async function recordAuthorizedHandoff(
  access: Awaited<ReturnType<typeof requireWorkspaceContact>>,
  route: "worker" | "request" | "marketplace" | "workspace"
) {
  const { error } = await access.db.from("employer_contact_handoffs")
    .insert({ order_id: access.orderId, product: access.product, route });
  if (error) console.warn("Authorized contact handoff was not recorded.", { route, product: access.product });
}

export function contactAccessResponse(error: unknown, headers: Record<string, string>) {
  const status = error instanceof ContactAccessError ? error.status : 503;
  const message = status === 503 ? "Contacto temporalmente no disponible." : status === 429 ? "Espera antes de abrir más contactos." :
    status === 404 ? "Este contacto no está disponible." : status === 401 ? "Verifica tu cuenta para contactar trabajadores." : "Necesitas créditos para desbloquear este contacto.";
  return Response.json({ error: message, paywall: status === 401 || status === 402 }, { status, headers });
}
