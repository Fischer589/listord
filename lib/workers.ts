import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseClient } from "./supabase";
import type { Worker } from "./types";

type WorkerFilters = {
  city?: string;
  skill?: string;
  income?: string;
  workStyle?: string;
};

export type WorkersResult =
  | { ok: true; workers: Worker[]; verifiedWorkerCount: number }
  | {
      ok: false;
      workers: [];
      message: string;
      verifiedWorkerCount: number;
    };

const WORKERS_LOAD_ERROR =
  "No pudimos cargar los trabajadores ahora mismo. Intenta de nuevo en unos minutos.";

export async function getWorkers(filters: WorkerFilters): Promise<Worker[]> {
  const result = await getWorkersResult(filters);

  return result.workers;
}

export async function getWorkersResult(
  _filters: WorkerFilters
): Promise<WorkersResult> {
  noStore();

  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      ok: false,
      workers: [],
      message: WORKERS_LOAD_ERROR,
      verifiedWorkerCount: 0
    };
  }

  const verifiedCountQuery = supabase
    .from("workers")
    .select("id", { count: "exact", head: true })
    .eq("is_verified", true);

  const query = supabase
    .from("workers")
    .select(`
      id,
      full_name,
      photo_url,
      city,
      whatsapp_number,
      skills,
      desired_income,
      availability,
      work_style,
      short_intro,
      is_verified,
      created_at
    `)
    .eq("is_verified", true)
    .order("created_at", { ascending: false });

  const [
    { count: verifiedWorkerCount, error: verifiedCountError },
    { data, error }
  ] = await Promise.all([verifiedCountQuery, query]);

  if (verifiedCountError) {
    console.warn("Verified worker count query failed.", {
      code: verifiedCountError.code
    });
  }

  if (error) {
    console.warn("Worker listing query failed.", {
      code: error.code
    });
    return {
      ok: false,
      workers: [],
      message: WORKERS_LOAD_ERROR,
      verifiedWorkerCount: verifiedWorkerCount ?? 0
    };
  }

  console.info("Verified worker count loaded:", verifiedWorkerCount ?? 0);
  console.info("Verified workers returned:", data?.length ?? 0);

  return {
    ok: true,
    workers: data ?? [],
    verifiedWorkerCount: verifiedWorkerCount ?? 0
  };
}
