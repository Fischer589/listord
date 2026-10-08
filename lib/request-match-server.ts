import { availabilityRenewalEnabled } from "./availability";
import { getSupabaseAdminClient } from "./supabase-admin";
import type { MatchRow } from "./request-matching";
import { getSupabaseClient } from "./supabase";
import { findMatches, MATCH_COLUMNS, MATCH_LIMIT, MATCH_WINDOW_DAYS } from "./request-matching";
import type { RequestDraft } from "./request-specification";

export async function getRequestMatches(draft: RequestDraft) {
  const now = new Date();
  if (availabilityRenewalEnabled()) {
    const admin = getSupabaseAdminClient();
    if (!admin) throw new Error("MATCH_DATA_UNAVAILABLE");
    return findMatches(draft, async () => {
      const { data, error, count } = await admin.from("worker_availability")
        .select(`confirmed_at,workers!inner(${MATCH_COLUMNS})`, { count: "exact" })
        .eq("available", true).eq("workers.is_verified", true).eq("workers.available_now", true)
        .gt("confirmed_at", new Date(now.getTime() - MATCH_WINDOW_DAYS * 86400000).toISOString())
        .lte("confirmed_at", now.toISOString()).gt("access_expires_at", now.toISOString())
        .order("worker_id").range(0, MATCH_LIMIT - 1).abortSignal(AbortSignal.timeout(8000));
      return { error, count, data: data?.map(row => ({ ...(row.workers as unknown as MatchRow), availability_confirmed_at: row.confirmed_at })) ?? null };
    }, now, "confirmed");
  }
  const client = getSupabaseClient();
  if (!client) throw new Error("MATCH_DATA_UNAVAILABLE");
  return findMatches(draft, () => client.from("workers")
    .select(MATCH_COLUMNS, { count: "exact" })
    .eq("is_verified", true).eq("available_now", true)
    .gte("created_at", new Date(now.getTime() - MATCH_WINDOW_DAYS * 86400000).toISOString())
    .lte("created_at", now.toISOString()).order("id").range(0, MATCH_LIMIT - 1)
    .abortSignal(AbortSignal.timeout(8000)), now);
}

/** Bound bytes even if Content-Length is missing or forged. */
export async function readMatchBody(request: Request): Promise<unknown> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("INVALID_REQUEST");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("INVALID_REQUEST");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_REQUEST");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 12000) { await reader.cancel(); throw new Error("INVALID_REQUEST"); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export const MATCH_HEADERS = { "Cache-Control": "private, no-store" };
