import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { MATCH_HEADERS, readMatchBody } from "@/lib/request-match-server";
import { isFreshAvailability, validAvailabilityKey } from "@/lib/availability";

export async function POST(request: Request) {
  const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers: MATCH_HEADERS });
  const body = await readMatchBody(request).catch(() => null) as { key?: unknown; available?: unknown; action?: unknown } | null;
  if (!validAvailabilityKey(body?.key) || !["status", "renew"].includes(String(body?.action)) || (body?.action === "renew" && typeof body.available !== "boolean")) return reply("Usa tu enlace privado de disponibilidad.", 400);
  const tokenHash = createHash("sha256").update(body.key).digest("hex");
  try {
    const client = getSupabaseAdminClient();
    if (!client) return reply("No pudimos actualizar la disponibilidad. Intenta de nuevo.", 503);
    if (body.action === "renew") {
      const { data, error } = await client.rpc("renew_worker_availability", { p_token_hash: tokenHash, p_available: body.available }).abortSignal(AbortSignal.timeout(8000));
      if (error) return reply("No pudimos actualizar la disponibilidad. Intenta de nuevo.", 503);
      if (!data?.length) return reply("Este enlace no está vigente o el perfil no está aprobado. Solicita ayuda para recuperarlo.", 403);
      return NextResponse.json({ available: data[0].available, confirmedAt: data[0].confirmed_at, fresh: isFreshAvailability(data[0].available, data[0].confirmed_at) }, { headers: MATCH_HEADERS });
    }
    const { data, error } = await client.from("worker_availability").select("available,confirmed_at,workers!inner(is_verified)")
      .eq("token_hash", tokenHash).gt("access_expires_at", new Date().toISOString()).eq("workers.is_verified", true).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    if (error) return reply("No pudimos consultar la disponibilidad. Intenta de nuevo.", 503);
    if (!data) return reply("Este enlace no está vigente o el perfil no está aprobado. Solicita ayuda para recuperarlo.", 403);
    return NextResponse.json({ available: data.available, confirmedAt: data.confirmed_at, fresh: isFreshAvailability(data.available, data.confirmed_at) }, { headers: MATCH_HEADERS });
  } catch { return reply("No pudimos consultar la disponibilidad. Intenta de nuevo.", 503); }
}
