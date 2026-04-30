import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseClient } from "./supabase";
import type { WorkStyle, Worker } from "./types";

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
const workStyles = new Set<WorkStyle>([
  "structured",
  "creative",
  "hands_on",
  "people_oriented",
  "systems_oriented",
  "fast_paced",
  "detail_oriented",
  "flexible"
]);

function isWorkStyle(value: string | undefined): value is WorkStyle {
  return Boolean(value && workStyles.has(value as WorkStyle));
}

export async function getWorkers(filters: WorkerFilters): Promise<Worker[]> {
  const result = await getWorkersResult(filters);

  return result.workers;
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

  const verifiedCountQuery = supabase
    .from("workers")
    .select("id", { count: "exact", head: true })
    .eq("is_verified", true);

  let query = supabase
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

  const city = filters.city?.trim();
  const maxIncome = Number(filters.income);
  const skill = filters.skill?.trim().toLowerCase();
  const workStyle = filters.workStyle?.trim();

  if (city) {
    query = query.ilike("city", `%${city}%`);
  }

  if (Number.isFinite(maxIncome) && maxIncome > 0) {
    query = query.lte("desired_income", maxIncome);
  }

  if (isWorkStyle(workStyle)) {
    query = query.eq("work_style", workStyle);
  }

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
  console.info("Worker count loaded after database filters:", data?.length ?? 0);

  const workers = skill
    ? (data ?? []).filter((worker) =>
        (Array.isArray(worker.skills) ? worker.skills : []).some(
          (workerSkill: string) =>
            workerSkill.toLowerCase().includes(skill)
        )
      )
    : data ?? [];

  console.info("Filtered worker count:", workers.length);

  return { ok: true, workers, verifiedWorkerCount: verifiedWorkerCount ?? 0 };
}
