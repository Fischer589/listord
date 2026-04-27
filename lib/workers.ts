import { getSupabaseClient } from "./supabase";
import type { Worker } from "./types";

type WorkerFilters = {
  city?: string;
  skill?: string;
  income?: string;
  availableNow?: string;
  workStyle?: string;
};

export async function getWorkers(filters: WorkerFilters): Promise<Worker[]> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "ListoRD workers debug: Supabase env is missing or invalid."
      );
      console.log("ListoRD workers count:", 0);
    }

    return [];
  }

  const query = supabase
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
      created_at
    `)
    .order("available_now", { ascending: false })
    .order("rating_average", { ascending: false });

  const { data, error } = await query;

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("ListoRD workers query failed:", {
        message: error.message,
        code: error.code
      });
      console.log("ListoRD workers count:", 0);
    }

    return [];
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("ListoRD workers count:", data?.length ?? 0);
    console.log("ListoRD workers response:", {
      count: data?.length ?? 0,
      firstWorkerId: data?.[0]?.id ?? null
    });
    console.log("ListoRD workers filters ignored temporarily:", filters);
  }

  return data ?? [];
}
