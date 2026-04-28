import { revalidatePath } from "next/cache";
import { AppHeader } from "@/components/app-header";
import { formatIncomeShort, workStyleLabels } from "@/lib/format";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Worker } from "@/lib/types";

async function approveWorker(formData: FormData) {
  "use server";

  const workerId = String(formData.get("worker_id") || "").trim();
  const supabase = getSupabaseAdminClient();

  if (!workerId || !supabase) {
    return;
  }

  await supabase
    .from("workers")
    .update({ is_verified: true })
    .eq("id", workerId);

  revalidatePath("/admin/workers");
  revalidatePath("/");
}

async function getPendingWorkers(): Promise<Worker[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
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
      created_at
    `)
    .eq("is_verified", false)
    .order("created_at", { ascending: true });

  if (error) {
    return [];
  }

  return data ?? [];
}

export default async function AdminWorkersPage() {
  const workers = await getPendingWorkers();

  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <section className="container py-6">
          <div className="mb-5">
            <p className="text-sm font-black uppercase tracking-wide text-hoja">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-black text-ink">
              Trabajadores pendientes
            </h1>
            <p className="mt-2 font-bold text-black/60">
              {workers.length} perfiles esperando aprobacion.
            </p>
          </div>

          {workers.length === 0 ? (
            <div className="rounded-xl border border-black/10 bg-white p-6 shadow-soft">
              <h2 className="text-xl font-black text-ink">
                No hay trabajadores pendientes
              </h2>
              <p className="mt-2 font-bold text-black/60">
                Cuando lleguen nuevos registros apareceran aqui.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {workers.map((worker) => {
                const skills = Array.isArray(worker.skills)
                  ? worker.skills
                  : [];
                const availability = Array.isArray(worker.availability)
                  ? worker.availability
                  : [];
                const workStyle =
                  worker.work_style && worker.work_style in workStyleLabels
                    ? workStyleLabels[worker.work_style]
                    : null;

                return (
                  <article
                    key={worker.id}
                    className="rounded-xl border border-black/10 bg-white p-4 shadow-soft"
                  >
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-2xl font-black text-ink">
                            {worker.full_name}
                          </h2>
                          <span className="rounded-md bg-mango/25 px-2 py-1 text-xs font-black text-ink">
                            Pendiente
                          </span>
                        </div>
                        <p className="mt-2 font-bold text-black/70">
                          {worker.city} ·{" "}
                          {formatIncomeShort(
                            worker.desired_income,
                            worker.income_type
                          )}
                        </p>
                        <p className="mt-3 leading-7 text-black/75">
                          {worker.short_intro}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
                          {skills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-md bg-mango/20 px-2 py-1 text-ink"
                            >
                              {skill}
                            </span>
                          ))}
                          {availability.map((item) => (
                            <span
                              key={item}
                              className="rounded-md bg-cielo px-2 py-1 text-ink"
                            >
                              {item}
                            </span>
                          ))}
                          {workStyle && (
                            <span className="rounded-md bg-[#f4f1ea] px-2 py-1 text-black/75">
                              {workStyle}
                            </span>
                          )}
                        </div>
                      </div>

                      <form action={approveWorker}>
                        <input
                          type="hidden"
                          name="worker_id"
                          value={worker.id}
                        />
                        <button
                          type="submit"
                          className="tap-target w-full rounded-md bg-hoja px-5 py-3 font-black text-white md:w-auto"
                        >
                          Aprobar trabajador
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
