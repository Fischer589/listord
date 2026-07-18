import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseClient } from "./supabase";
import { workerMatchesCity, workerMatchesSkill } from "./search";
import { isBoostActive } from "./boost";
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
  income_type,
  last_boosted_at,
  boost_expires_at
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
  const now = new Date();

  // Sort: active boosts first (most recently boosted wins), then featured,
  // then original order (created_at DESC from DB). Boost priority never
  // reorders across category/city — this sort runs on the already-scoped
  // list, and the .filter() below still applies every existing filter.
  const boosted = workers
    .filter(w => isBoostActive({ boostExpiresAt: w.boost_expires_at ?? null }, now))
    .sort((a, b) => {
      const aTime = a.last_boosted_at ? new Date(a.last_boosted_at).getTime() : 0;
      const bTime = b.last_boosted_at ? new Date(b.last_boosted_at).getTime() : 0;
      return bTime - aTime;
    });
  const boostedIds = new Set(boosted.map(w => w.id));
  const featured = workers.filter(w => !boostedIds.has(w.id) && w.is_featured === true);
  const regular  = workers.filter(w => !boostedIds.has(w.id) && w.is_featured !== true);
  const sorted   = [...boosted, ...featured, ...regular];

  return sorted.filter(worker => {
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
      // Safe defaults — is_featured/is_pro require the Phase 6 DB migration.
      // Once migration is confirmed, restore these columns to HOMEPAGE_WORKER_SELECT.
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
