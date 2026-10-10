import { getSupabaseAdminClient } from "./supabase-admin";
import { getSupabaseClient } from "./supabase";

export class MarketplaceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function verifiedMarketplaceUser(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(authorization)) throw new MarketplaceError(401, "Inicia sesión con una cuenta verificada.");
  const auth = getSupabaseClient(8000);
  if (!auth) throw new MarketplaceError(503, "Servicio no disponible.");
  // A fresh Auth server check, not getSession(), unverified claims or user metadata.
  const { data, error } = await auth.auth.getUser(authorization.slice(7));
  if (error || !data.user || data.user.is_anonymous || !(data.user.email_confirmed_at || data.user.phone_confirmed_at)) throw new MarketplaceError(401, "Inicia sesión con una cuenta verificada.");
  return data.user.id;
}
export function marketplaceAdmin() {
  const client = getSupabaseAdminClient();
  if (!client) throw new MarketplaceError(503, "Servicio no disponible.");
  return client;
}
export function rpcFailure(error: { message: string } | null) {
  if (!error) return;
  if (error.message.includes("RATE_LIMIT")) throw new MarketplaceError(429, "Has alcanzado el límite. Intenta más tarde.");
  if (/NOT_FOUND|OWNERSHIP_REQUIRED|SELF_RESPONSE/.test(error.message)) throw new MarketplaceError(403, "No puedes realizar esta operación.");
  if (/NOT_OPEN|INVALID_|CONSENT_REQUIRED/.test(error.message)) throw new MarketplaceError(409, "La oportunidad cambió o la operación no es válida.");
  throw new MarketplaceError(503, "No se guardó la operación. Puedes volver a intentarlo.");
}
