import { getSupabaseClient } from "./supabase";
import type { Worker } from "./types";

type WorkerFilters = {
  city?: string;
  skill?: string;
  income?: string;
  availableNow?: string;
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
      user_id,
      full_name,
      photo_url,
      country,
      region,
      city,
      skills,
      desired_income,
      income_type,
      availability,
      available_now,
      work_style,
      work_style_note,
      job_duration_preference,
      duration_note,
      short_intro,
      experience,
      show_up_count,
      completed_jobs_count,
      hired_count,
      hire_rate,
      rating_average,
      rating_count,
      is_verified,
      created_at,
      updated_at
    `)
    .eq("is_verified", true)
    .order("available_now", { ascending: false })
    .order("rating_average", { ascending: false });

  const city = filters.city?.trim();
  const maxIncome = Number(filters.income);
  const skill = filters.skill?.trim().toLowerCase();

  if (city) {
    query = query.ilike("city", `%${city}%`);
  }

  if (Number.isFinite(maxIncome) && maxIncome > 0) {
    query = query.lte("desired_income", maxIncome);
  }

  if (filters.availableNow === "true") {
    query = query.eq("available_now", true);
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
