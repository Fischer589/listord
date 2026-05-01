import { unstable_noStore as noStore } from "next/cache";
import { getPublicEnv } from "./env";
import { getSupabaseClient } from "./supabase";
import type { Worker } from "./types";

type WorkerFilters = {
  city?: string;
  skill?: string;
  income?: string;
  workStyle?: string;
};

export type WorkersResult =
  | {
      ok: true;
      workers: Worker[];
      verifiedWorkerCount: number;
      diagnostics: HomepageWorkerDiagnostics;
    }
  | {
      ok: false;
      workers: [];
      message: string;
      verifiedWorkerCount: number;
      diagnostics: HomepageWorkerDiagnostics;
    };

export type HomepageWorkerDiagnostics = {
  supabaseUrlHost: string;
  totalWorkerCount: number;
  verifiedWorkerCount: number;
  homepageWorkerNames: string[];
  queryErrorMessage?: string;
};

const WORKERS_LOAD_ERROR =
  "No pudimos cargar los trabajadores ahora mismo. Intenta de nuevo en unos minutos.";

function getSupabaseUrlHost() {
  const publicEnv = getPublicEnv();

  if (!publicEnv.isConfigured) {
    return "not configured";
  }

  try {
    return new URL(publicEnv.env.supabaseUrl).host;
  } catch {
    return "invalid URL";
  }
}

export async function getWorkers(filters: WorkerFilters): Promise<Worker[]> {
  const result = await getWorkersResult(filters);

  return result.workers;
}

export async function getWorkersResult(
  _filters: WorkerFilters
): Promise<WorkersResult> {
  noStore();

  const supabase = getSupabaseClient();
  const supabaseUrlHost = getSupabaseUrlHost();

  console.info("Homepage workers Supabase URL host:", supabaseUrlHost);

  if (!supabase) {
    const diagnostics = {
      supabaseUrlHost,
      totalWorkerCount: 0,
      verifiedWorkerCount: 0,
      homepageWorkerNames: [],
      queryErrorMessage: "Supabase public client is not configured."
    };

    return {
      ok: false,
      workers: [],
      message: WORKERS_LOAD_ERROR,
      verifiedWorkerCount: 0,
      diagnostics
    };
  }

  const totalCountQuery = supabase
    .from("workers")
    .select("id", { count: "exact", head: true });

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
    { count: totalWorkerCount, error: totalCountError },
    { count: verifiedWorkerCount, error: verifiedCountError },
    { data, error }
  ] = await Promise.all([totalCountQuery, verifiedCountQuery, query]);

  console.info("Homepage workers raw total count:", totalWorkerCount);
  console.info("Homepage workers raw verified count:", verifiedWorkerCount);

  if (totalCountError) {
    console.warn("Homepage total worker count query failed.", {
      message: totalCountError.message,
      code: totalCountError.code,
      details: totalCountError.details
    });
  }

  if (verifiedCountError) {
    console.warn("Homepage verified worker count query failed.", {
      message: verifiedCountError.message,
      code: verifiedCountError.code,
      details: verifiedCountError.details
    });
  }

  const queryError =
    error?.message ?? verifiedCountError?.message ?? totalCountError?.message;

  const diagnostics = {
    supabaseUrlHost,
    totalWorkerCount: totalWorkerCount ?? 0,
    verifiedWorkerCount: verifiedWorkerCount ?? 0,
    homepageWorkerNames:
      data?.slice(0, 5).map((worker) => worker.full_name || "(sin nombre)") ??
      [],
    queryErrorMessage: queryError
  };

  if (error) {
    console.warn("Homepage worker listing query failed.", {
      message: error.message,
      code: error.code,
      details: error.details
    });
    return {
      ok: false,
      workers: [],
      message: error.message || WORKERS_LOAD_ERROR,
      verifiedWorkerCount: verifiedWorkerCount ?? 0,
      diagnostics
    };
  }

  console.info("Verified worker count loaded:", verifiedWorkerCount ?? 0);
  console.info("Verified workers returned:", data?.length ?? 0);

  return {
    ok: true,
    workers: data ?? [],
    verifiedWorkerCount: verifiedWorkerCount ?? 0,
    diagnostics
  };
}
