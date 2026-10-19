import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildWorkerActivationReport, type ActivationRecord, type ActivationWorker } from "@/lib/worker-activation-report";

const headers = { "Cache-Control": "private, no-store" };
const pageSize = 500;
const maxRows = 10000;

export async function GET() {
  await requireAdmin();
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: "Resumen no disponible." }, { status: 503, headers });
  try {
    const workers: ActivationWorker[] = [];
    const records: ActivationRecord[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, count, error } = await client.from("workers")
        .select("id,full_name,city,skills,is_verified,available_now,owner_user_id,created_at,desired_income,income_type", { count: "exact" })
        .eq("is_verified", true).order("id").range(offset, offset + pageSize - 1)
        .abortSignal(AbortSignal.timeout(8000));
      if (error || count === null || count > maxRows || !data || data.length !== Math.min(pageSize, Math.max(count - offset, 0))) throw new Error("workers unavailable");
      workers.push(...data as ActivationWorker[]);
      if (workers.length === count) break;
    }
    for (let offset = 0; ; offset += pageSize) {
      const { data, count, error } = await client.from("worker_availability")
        .select("worker_id,available,confirmed_at,access_expires_at", { count: "exact" })
        .order("worker_id").range(offset, offset + pageSize - 1)
        .abortSignal(AbortSignal.timeout(8000));
      if (error || count === null || count > maxRows || !data || data.length !== Math.min(pageSize, Math.max(count - offset, 0))) throw new Error("availability unavailable");
      records.push(...data);
      if (records.length === count) break;
    }
    return NextResponse.json(buildWorkerActivationReport(workers, records), { headers });
  } catch {
    return NextResponse.json({ error: "Resumen no disponible." }, { status: 503, headers });
  }
}
