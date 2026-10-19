import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { MATCH_HEADERS, readMatchBody } from "@/lib/request-match-server";

export async function POST(request: Request) {
  await requireAdmin();
  const body = await readMatchBody(request).catch(() => null) as { workerId?: unknown; ownershipConfirmed?: unknown; consentConfirmed?: unknown } | null;
  if (body?.ownershipConfirmed !== true || body.consentConfirmed !== true || typeof body.workerId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.workerId)) return NextResponse.json({ error: "Confirma la identidad del titular y su solicitud de recibir el enlace privado." }, { status: 400, headers: MATCH_HEADERS });
  try {
    const client = getSupabaseAdminClient();
    if (!client) throw new Error("unavailable");
    // An approved legacy listing is not proof that this account owns it.
    // Link ownership through the audited recovery flow before issuing a key.
    const worker = await client.from("workers").select("owner_user_id")
      .eq("id", body.workerId).eq("is_verified", true)
      .abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    if (worker.error || !worker.data?.owner_user_id) return NextResponse.json({ error: "Vincula primero a un titular verificado. No se creó ningún enlace." }, { status: 409, headers: MATCH_HEADERS });
    const key = randomBytes(32).toString("hex");
    const { error } = await client.rpc("issue_worker_availability", { p_worker_id: body.workerId, p_token_hash: createHash("sha256").update(key).digest("hex") }).abortSignal(AbortSignal.timeout(8000));
    if (error) throw new Error("unavailable");
    return NextResponse.json({ path: `/trabajadores/disponibilidad#clave=${key}` }, { headers: MATCH_HEADERS });
  } catch { return NextResponse.json({ error: "No se pudo crear el enlace. Verifica el perfil aprobado y la configuración." }, { status: 503, headers: MATCH_HEADERS }); }
}
