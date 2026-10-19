import { verifiedMarketplaceUser } from "./marketplace-server";
import { getSupabaseAdminClient } from "./supabase-admin";
import { workspaceSessionPattern, workspaceSessionPrefix } from "./employer-workspace";
import { directContactReadEnabled } from "./direct-contact";

export class ContactAccessError extends Error {
  constructor(public status: number) { super(status === 402 ? "Desbloquea el contacto con trabajadores." : "Verifica tu cuenta para contactar trabajadores."); }
}

/** The paid order and the authenticated account must match on every contact attempt. */
export async function requireWorkspaceContact(request: Request, workerId?: string) {
  let ownerId: string;
  try { ownerId = await verifiedMarketplaceUser(request); }
  catch { throw new ContactAccessError(401); }
  const db = getSupabaseAdminClient();
  const sessionPrefix = workspaceSessionPrefix();
  if (!db || !sessionPrefix) throw new ContactAccessError(503);
  const { data, error } = await db.from("employer_workspace_orders")
    .select("id").eq("owner_user_id", ownerId).eq("status", "paid")
    .gt("access_until", new Date().toISOString()).like("stripe_session_id", workspaceSessionPattern(sessionPrefix))
    .limit(1).abortSignal(AbortSignal.timeout(8000));
  if (error) throw new ContactAccessError(503);
  if (!data?.length) {
    if (!workerId || !directContactReadEnabled()) throw new ContactAccessError(402);
    const direct = await db.from("employer_direct_contact_orders").select("id")
      .eq("owner_user_id", ownerId).eq("worker_id", workerId).eq("status", "paid")
      .like("stripe_session_id", workspaceSessionPattern(sessionPrefix))
      .limit(1).abortSignal(AbortSignal.timeout(8000));
    if (direct.error) throw new ContactAccessError(503);
    if (!direct.data?.length) throw new ContactAccessError(402);
    return { ownerId, db, product: "direct" as const, orderId: direct.data[0].id as string };
  }
  return { ownerId, db, product: "workspace" as const, orderId: data[0].id as string };
}

/** Record only an authorized URL issuance, with no contact details or URL. */
export async function recordAuthorizedHandoff(
  access: Awaited<ReturnType<typeof requireWorkspaceContact>>,
  route: "worker" | "request" | "marketplace" | "workspace"
) {
  try {
    const { error } = await access.db.from("employer_contact_handoffs")
      .insert({ order_id: access.orderId, product: access.product, route });
    if (error) throw error;
  } catch {
    console.warn("Authorized contact handoff was not recorded.", { route, product: access.product });
  }
}

export function contactAccessResponse(error: unknown, headers: Record<string, string>) {
  const status = error instanceof ContactAccessError ? error.status : 503;
  return Response.json({ error: status === 503 ? "Contacto temporalmente no disponible." :
    status === 401 ? "Verifica tu cuenta para contactar trabajadores." : "Desbloquea el contacto con trabajadores.", paywall: status === 401 || status === 402 },
    { status, headers });
}
