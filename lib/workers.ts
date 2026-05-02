import { unstable_noStore as noStore } from "next/cache";
import { getPublicEnvDiagnostics } from "./env";
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
  hasNextPublicSupabaseUrl: boolean;
  hasNextPublicSupabaseAnonKey: boolean;
  supabaseUrlHost: string;
  totalWorkerCount: number;
  verifiedWorkerCount: number;
  homepageWorkerNames: string[];
  queryErrorMessage?: string;
  queryErrorCode?: string;
  queryErrorDetails?: string;
  queryErrorHint?: string;
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
  short_intro
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

export async function getWorkersResult(
  _filters: WorkerFilters
): Promise<WorkersResult> {
  noStore();

  const supabase = getSupabaseClient();
  const publicEnvDiagnostics = getPublicEnvDiagnostics();
  const supabaseUrlHost = publicEnvDiagnostics.supabaseUrlHost;

  console.info("Homepage workers Supabase diagnostics:", publicEnvDiagnostics);

  if (!supabase) {
    const diagnostics = {
      ...publicEnvDiagnostics,
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

  try {
    const { data, error } = await supabase
      .from("workers")
      .select(HOMEPAGE_WORKER_SELECT)
      .eq("is_verified", true);

    if (error) {
      logHomepageWorkerQueryError(error);

      const diagnostics = getErrorDiagnostics(
        publicEnvDiagnostics,
        supabaseUrlHost,
        error
      );

      return {
        ok: false,
        workers: [],
        message: error.message || WORKERS_LOAD_ERROR,
        verifiedWorkerCount: 0,
        diagnostics
      };
    }

    const rows = (data ?? []) as HomepageWorkerRow[];
    const workers = rows.map((worker) => ({
      ...worker,
      is_verified: true
    }));
    const verifiedWorkerCount = workers.length;
    const diagnostics = {
      ...publicEnvDiagnostics,
      supabaseUrlHost,
      totalWorkerCount: verifiedWorkerCount,
      verifiedWorkerCount,
      homepageWorkerNames: workers
        .slice(0, 5)
        .map((worker) => worker.full_name || "(sin nombre)")
    };

    console.info("Verified workers returned:", verifiedWorkerCount);

    return {
      ok: true,
      workers,
      verifiedWorkerCount,
      diagnostics
    };
  } catch (error) {
    const normalizedError = normalizeUnknownError(error);
    logHomepageWorkerQueryError(normalizedError);

    const diagnostics = getErrorDiagnostics(
      publicEnvDiagnostics,
      supabaseUrlHost,
      normalizedError
    );

    return {
      ok: false,
      workers: [],
      message: normalizedError.message || WORKERS_LOAD_ERROR,
      verifiedWorkerCount: 0,
      diagnostics
    };
  }
}

function getErrorDiagnostics(
  publicEnvDiagnostics: ReturnType<typeof getPublicEnvDiagnostics>,
  supabaseUrlHost: string,
  error: SupabaseErrorDetails
): HomepageWorkerDiagnostics {
  return {
    ...publicEnvDiagnostics,
    supabaseUrlHost,
    totalWorkerCount: 0,
    verifiedWorkerCount: 0,
    homepageWorkerNames: [],
    queryErrorMessage: error.message,
    queryErrorCode: error.code,
    queryErrorDetails: error.details,
    queryErrorHint: error.hint
  };
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
    return {
      message: error.message
    };
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

  return {
    message: String(error)
  };
}
