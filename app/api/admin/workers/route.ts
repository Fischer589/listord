import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { readJsonBody } from "@/lib/http-json";
import { uuid } from "@/lib/marketplace";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const headers = { "Cache-Control": "private, no-store" };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function POST(request: Request) {
  await requireAdmin();
  const body = await readJsonBody(request, 2048).catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return reply({ error: "Solicitud inválida." }, 400);
  }
  const input = body as Record<string, unknown>;
  if (input.action !== "reject" || !uuid(input.workerId) || input.confirmId !== input.workerId) {
    return reply({ error: "Confirma el registro que deseas rechazar." }, 400);
  }
  const db = getSupabaseAdminClient();
  if (!db) return reply({ error: "La revisión de trabajadores no está disponible." }, 503);

  try {
    const { data, error } = await db.from("workers")
      .update({ rejected_at: new Date().toISOString() })
      .eq("id", input.workerId)
      .eq("is_verified", false)
      .is("rejected_at", null)
      .select("id")
      .abortSignal(AbortSignal.timeout(8000))
      .maybeSingle();
    if (error) throw error;
    if (!data || data.id !== input.workerId) {
      return reply({ error: "El registro ya no está pendiente. Actualiza la página." }, 409);
    }
    return reply({ saved: true, workerId: data.id });
  } catch (error) {
    console.warn("Pending worker rejection failed.", { code: error && typeof error === "object" && "code" in error ? error.code : "unknown" });
    return reply({ error: "No se pudo rechazar el registro. Intenta de nuevo." }, 503);
  }
}
