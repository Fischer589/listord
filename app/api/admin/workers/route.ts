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
  if (input.action !== "delete" || !uuid(input.workerId) || input.confirmId !== input.workerId) {
    return reply({ error: "Confirma el registro que deseas eliminar." }, 400);
  }
  const db = getSupabaseAdminClient();
  if (!db) return reply({ error: "La revisión de trabajadores no está disponible." }, 503);

  try {
    const { data, error } = await db.rpc("admin_delete_pending_worker", { p_worker_id: input.workerId })
      .abortSignal(AbortSignal.timeout(8000));
    if (error?.code === "23503") {
      return reply({ error: "Este trabajador tiene historial asociado y no se puede eliminar sin afectar esos registros." }, 409);
    }
    if (error) throw error;
    if (data === "protected") {
      return reply({ error: "Este trabajador tiene una cuenta o historial de pagos, solicitudes, contacto o activación. No se puede eliminar sin afectar esos registros." }, 409);
    }
    if (data === "not_pending") {
      return reply({ error: "El registro ya no está pendiente. Actualiza la página." }, 409);
    }
    if (data !== "deleted") throw new Error("Unexpected pending worker deletion result");
    return reply({ deleted: true, workerId: input.workerId });
  } catch (error) {
    console.warn("Pending worker deletion failed.", { code: error && typeof error === "object" && "code" in error ? error.code : "unknown" });
    return reply({ error: "No se pudo eliminar el registro. Intenta de nuevo." }, 503);
  }
}
