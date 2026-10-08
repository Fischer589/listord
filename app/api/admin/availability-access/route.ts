import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { availabilityRenewalEnabled } from "@/lib/availability";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { MATCH_HEADERS, readMatchBody } from "@/lib/request-match-server";

export async function POST(request: Request) {
  requireAdmin();
  if (!availabilityRenewalEnabled()) return NextResponse.json({ error: "Renovación deshabilitada hasta verificar migración y seguridad." }, { status: 503, headers: MATCH_HEADERS });
  const body = await readMatchBody(request).catch(() => null) as { workerId?: unknown; ownershipConfirmed?: unknown } | null;
  if (body?.ownershipConfirmed !== true || typeof body.workerId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.workerId)) return NextResponse.json({ error: "Confirma la identidad del titular y el perfil." }, { status: 400, headers: MATCH_HEADERS });
  try {
    const client = getSupabaseAdminClient();
    if (!client) throw new Error("unavailable");
    const key = randomBytes(32).toString("hex");
    const { error } = await client.rpc("issue_worker_availability", { p_worker_id: body.workerId, p_token_hash: createHash("sha256").update(key).digest("hex") }).abortSignal(AbortSignal.timeout(8000));
    if (error) throw new Error("unavailable");
    return NextResponse.json({ path: `/trabajadores/disponibilidad#clave=${key}` }, { headers: MATCH_HEADERS });
  } catch { return NextResponse.json({ error: "No se pudo crear el enlace. Verifica el perfil aprobado y la configuración." }, { status: 503, headers: MATCH_HEADERS }); }
}
