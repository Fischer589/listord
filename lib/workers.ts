import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdminClient } from "./supabase-admin";
import { publicWorkerFields } from "./public-worker";
import { workerMatchesCity, workerMatchesSkill } from "./search";
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
    }
  | {
      ok: false;
      workers: [];
      message: string;
      verifiedWorkerCount: number;
    };

const WORKERS_LOAD_ERROR =
  "No pudimos cargar los trabajadores ahora mismo. Intenta de nuevo en unos minutos.";

// NOTE: is_featured and is_pro are NOT selected here.
// They require the Phase 6 DB migration to exist.
// Until that migration is confirmed, they default to false in the mapping below.
const HOMEPAGE_WORKER_SELECT = `
  id,
  full_name,
  city,
  work_style,
  desired_income,
  short_intro,
  skills,
  photo_url,
  created_at,
  available_now,
  rating_average,
  rating_count,
  hired_count,
  experience,
  income_type,
  last_boosted_at,
  boost_expires_at
`;

type HomepageWorkerRow = Pick<
  Worker,
  | "id"
  | "full_name"
  | "city"
  | "work_style"
  | "desired_income"
  | "short_intro"
  | "skills"
  | "photo_url"
  | "created_at"
  | "available_now"
  | "rating_average"
  | "rating_count"
  | "hired_count"
  | "experience"
  | "income_type"
  | "last_boosted_at"
  | "boost_expires_at"
>;

type SupabaseErrorDetails = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export async function getWorkers(filters: WorkerFilters): Promise<Worker[]> {
  const result = await getWorkersResult(filters);
  return result.workers;
}

/**
 * Applies in-memory filters to a worker list.
 * All filtering is done post-fetch so no Supabase schema changes are needed.
 */
function applyFilters(workers: Worker[], filters: WorkerFilters): Worker[] {
  // Preserve stable database order. Historical payments never affect discovery.
  return workers.filter(worker => {
    // City — normalized partial match
    if (filters.city?.trim()) {
      if (!workerMatchesCity(worker, filters.city)) return false;
    }

    // Skill / service — synonym-aware full-text match
    if (filters.skill?.trim()) {
      if (!workerMatchesSkill(worker, filters.skill)) return false;
    }

    // Max income — numeric threshold
    if (filters.income?.trim()) {
      const maxIncome = Number(filters.income);
      if (Number.isFinite(maxIncome) && maxIncome > 0) {
        const workerIncome = Number(worker.desired_income ?? 0);
        if (workerIncome > maxIncome) return false;
      }
    }

    // Work style — exact enum match
    if (filters.workStyle?.trim()) {
      if (worker.work_style !== filters.workStyle) return false;
    }

    return true;
  });
}

export async function getWorkersResult(
  filters: WorkerFilters
): Promise<WorkersResult> {
  noStore();

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      ok: false,
      workers: [],
      message: WORKERS_LOAD_ERROR,
      verifiedWorkerCount: 0
    };
  }

  try {
    const { data, error } = await supabase
      .from("workers")
      .select(HOMEPAGE_WORKER_SELECT)
      .eq("is_verified", true)
      .order("created_at", { ascending: false })
      .abortSignal(AbortSignal.timeout(8000));

    if (error) {
      logHomepageWorkerQueryError(error);
      return {
        ok: false,
        workers: [],
        message: WORKERS_LOAD_ERROR,
        verifiedWorkerCount: 0
      };
    }

    const rows = (data ?? []) as HomepageWorkerRow[];
    const allWorkers = rows.map((worker) => ({
      ...publicWorkerFields(worker),
      // Legacy paid badges are absent from discovery; financial rows are retained.
      is_featured: false as const,
      is_pro: false as const,
      is_verified: true
    }));

    const verifiedWorkerCount = allWorkers.length;
    const workers = applyFilters(allWorkers, filters);

    return {
      ok: true,
      workers,
      verifiedWorkerCount
    };
  } catch (error) {
    const normalizedError = normalizeUnknownError(error);
    logHomepageWorkerQueryError(normalizedError);
    return {
      ok: false,
      workers: [],
      message: WORKERS_LOAD_ERROR,
      verifiedWorkerCount: 0
    };
  }
}

function logHomepageWorkerQueryError(error: SupabaseErrorDetails) {
  console.error("Homepage worker listing query failed.", {
    code: error.code
  });
}

function normalizeUnknownError(error: unknown): SupabaseErrorDetails {
  if (error instanceof Error) {
    return { message: error.message };
  }
  if (error && typeof error === "object") {
    const maybeError = error as SupabaseErrorDetails;
    return {
      message: maybeError.message,
      code: maybeError.code,
      details: maybeError.details,
      hint: maybeError.hint
    };
  }
  return { message: String(error) };
}
