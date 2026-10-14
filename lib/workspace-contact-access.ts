import { verifiedMarketplaceUser } from "./marketplace-server";
import { getSupabaseAdminClient } from "./supabase-admin";

export class ContactAccessError extends Error {
  constructor(public status: number) { super(status === 402 ? "Desbloquea el contacto con trabajadores." : "Verifica tu cuenta para contactar trabajadores."); }
}

/** The paid order and the authenticated account must match on every contact attempt. */
export async function requireWorkspaceContact(request: Request) {
  let ownerId: string;
  try { ownerId = await verifiedMarketplaceUser(request); }
  catch { throw new ContactAccessError(401); }
  const db = getSupabaseAdminClient();
  if (!db) throw new ContactAccessError(503);
  const { data, error } = await db.from("employer_workspace_orders")
    .select("id").eq("owner_user_id", ownerId).eq("status", "paid")
    .gt("access_until", new Date().toISOString()).limit(1).abortSignal(AbortSignal.timeout(8000));
  if (error) throw new ContactAccessError(503);
  if (!data?.length) throw new ContactAccessError(402);
  return { ownerId, db };
}

export function contactAccessResponse(error: unknown, headers: Record<string, string>) {
  const status = error instanceof ContactAccessError ? error.status : 503;
  return Response.json({ error: status === 503 ? "Contacto temporalmente no disponible." :
    status === 401 ? "Verifica tu cuenta para contactar trabajadores." : "Desbloquea el contacto con trabajadores.", paywall: status === 401 || status === 402 },
    { status, headers });
}
