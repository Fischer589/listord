import { getSupabaseClient } from "./supabase";
import type { Worker } from "./types";

type WorkerFilters = {
  city?: string;
  skill?: string;
  income?: string;
  workStyle?: string;
};

export type WorkersResult =
  | { ok: true; workers: Worker[] }
  | { ok: false; workers: []; message: string };

const WORKERS_LOAD_ERROR =
  "No pudimos cargar los trabajadores ahora mismo. Intenta de nuevo en unos minutos.";

export async function getWorkers(filters: WorkerFilters): Promise<Worker[]> {
  const result = await getWorkersResult(filters);

  return result.workers;
}

export async function getWorkersResult(
  filters: WorkerFilters
): Promise<WorkersResult> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, workers: [], message: WORKERS_LOAD_ERROR };
  }

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
      is_verified
    `)
    .eq("is_verified", true);

  const city = filters.city?.trim();
  const maxIncome = Number(filters.income);
  const skill = filters.skill?.trim().toLowerCase();

  if (city) {
    query = query.ilike("city", `%${city}%`);
  }

  if (Number.isFinite(maxIncome) && maxIncome > 0) {
    query = query.lte("desired_income", maxIncome);
  }

  if (filters.workStyle) {
    query = query.eq("work_style", filters.workStyle);
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false, workers: [], message: WORKERS_LOAD_ERROR };
  }

  const workers = skill
    ? (data ?? []).filter((worker) =>
        (Array.isArray(worker.skills) ? worker.skills : []).some(
          (workerSkill: string) =>
            workerSkill.toLowerCase().includes(skill)
        )
      )
    : data ?? [];

  return { ok: true, workers };
}
