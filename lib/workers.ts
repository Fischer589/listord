import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseClient } from "./supabase";
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
const HOMEPAGE_WORKER_SELECT = `
  id,
  full_name,
  city,
  whatsapp_number,
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
  income_type
`;

type HomepageWorkerRow = Pick<
  Worker,
  | "id"
  | "full_name"
  | "city"
  | "whatsapp_number"
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

  const supabase = getSupabaseClient();

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
      .order("created_at", { ascending: false });

    if (error) {
      logHomepageWorkerQueryError(error);
      return {
        ok: false,
        workers: [],
        message: error.message || WORKERS_LOAD_ERROR,
        verifiedWorkerCount: 0
      };
    }

    const rows = (data ?? []) as HomepageWorkerRow[];
    const allWorkers = rows.map((worker) => ({
      ...worker,
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
      message: normalizedError.message || WORKERS_LOAD_ERROR,
      verifiedWorkerCount: 0
    };
  }
}

function logHomepageWorkerQueryError(error: SupabaseErrorDetails) {
  console.error("Homepage worker listing query failed.", {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint
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
