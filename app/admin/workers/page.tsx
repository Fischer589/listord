import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { AppHeader } from "@/components/app-header";
import { formatIncomeShort, workStyleLabels } from "@/lib/format";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Worker } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function approveWorker(formData: FormData) {
  "use server";

  const workerId = String(formData.get("worker_id") || "").trim();
  const supabase = getSupabaseAdminClient();

  if (!workerId || !supabase) {
    return;
  }

  const { error } = await supabase
    .from("workers")
    .update({ is_verified: true })
    .eq("id", workerId);

  if (error) {
    console.warn("Worker approval failed.", {
      code: error.code,
      workerId
    });
  }

  revalidatePath("/admin/workers");
  revalidatePath("/");
}

async function approveLocalTestWorker() {
  "use server";

  if (process.env.NODE_ENV === "production") {
    return;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const testWorker = {
    full_name: "Trabajador Prueba Local ListoRD",
    city: "Santo Domingo",
    whatsapp_number: "+18090000999",
    work_style: "flexible",
    desired_income: 1500,
    short_intro: "Perfil de prueba local para validar listado y contacto.",
    skills: [] as string[],
    availability: [] as string[],
    is_verified: true
  };

  const { data: existingWorker, error: lookupError } = await supabase
    .from("workers")
    .select("id")
    .eq("whatsapp_number", testWorker.whatsapp_number)
    .maybeSingle();

  if (lookupError) {
    console.warn("Local test worker lookup failed.", {
      code: lookupError.code
    });
    return;
  }

  const response = existingWorker?.id
    ? await supabase
        .from("workers")
        .update(testWorker)
        .eq("id", existingWorker.id)
    : await supabase.from("workers").insert(testWorker);

  if (response.error) {
    console.warn("Local test worker approval failed.", {
      code: response.error.code
    });
  }

  revalidatePath("/admin/workers");
  revalidatePath("/");
}

type AdminWorkersResult = {
  approvedCount: number;
  pendingCount: number;
  workers: Worker[];
};

function getWorkerCounts(workers: Worker[]) {
  return workers.reduce(
    (counts, worker) => {
      if (worker.is_verified) {
        counts.approvedCount += 1;
      } else {
        counts.pendingCount += 1;
      }

      return counts;
    },
    {
      approvedCount: 0,
      pendingCount: 0
    }
  );
}

async function getAdminWorkers(): Promise<AdminWorkersResult> {
  noStore();

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      approvedCount: 0,
      pendingCount: 0,
      workers: []
    };
  }

  const workersQuery = supabase
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
      created_at,
      edit_token
    `)
    .order("created_at", { ascending: false });

  const pendingCountQuery = supabase
    .from("workers")
    .select("id", { count: "exact", head: true })
    .eq("is_verified", false);

  const approvedCountQuery = supabase
    .from("workers")
    .select("id", { count: "exact", head: true })
    .eq("is_verified", true);

  const [
    { data, error },
    { count: pendingCount, error: pendingCountError },
    { count: approvedCount, error: approvedCountError }
  ] = await Promise.all([workersQuery, pendingCountQuery, approvedCountQuery]);

  if (error) {
    console.warn("Admin workers query failed.", {
      code: error.code
    });
    return {
      approvedCount: 0,
      pendingCount: 0,
      workers: []
    };
  }

  const workers = data ?? [];
  const fallbackCounts = getWorkerCounts(workers);

  if (pendingCountError || approvedCountError) {
    console.warn("Admin worker count query failed.", {
      approvedCountCode: approvedCountError?.code,
      pendingCountCode: pendingCountError?.code
    });
  }

  return {
    approvedCount: approvedCount ?? fallbackCounts.approvedCount,
    pendingCount: pendingCount ?? fallbackCounts.pendingCount,
    workers
  };
}

export default async function AdminWorkersPage() {
  const { approvedCount, pendingCount, workers } = await getAdminWorkers();
  const showLocalTestWorkerAction = process.env.NODE_ENV !== "production";

  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <section className="container py-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-hoja">
                Admin
              </p>
              <h1 className="mt-2 text-3xl font-black text-ink">
                Trabajadores registrados
              </h1>
            </div>
            <a
              href="/admin/logout"
              className="mt-1 shrink-0 rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/50 shadow-soft hover:bg-black/5"
            >
              Cerrar sesión
            </a>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-wide text-black/50">
                Pendientes
              </p>
              <p className="mt-1 text-3xl font-black text-ink">
                {pendingCount}
              </p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-wide text-black/50">
                Aprobados
              </p>
              <p className="mt-1 text-3xl font-black text-ink">
                {approvedCount}
              </p>
            </div>
          </div>

          {workers.length === 0 ? (
            <div className="rounded-xl border border-black/10 bg-white p-6 shadow-soft">
              <h2 className="text-xl font-black text-ink">
                No hay trabajadores cargados
              </h2>
              <p className="mt-2 font-bold text-black/60">
                Cuando lleguen registros apareceran aqui aunque les falten
                campos opcionales.
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
                const statusLabel = worker.is_verified
                  ? "Aprobado"
                  : "Pendiente";

                return (
                  <article
                    key={worker.id}
                    className="rounded-xl border border-black/10 bg-white p-4 shadow-soft"
                  >
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-2xl font-black text-ink">
                            {worker.full_name || "Sin nombre"}
                          </h2>
                          <span
                            className={
                              worker.is_verified
                                ? "rounded-md bg-hoja/15 px-2 py-1 text-xs font-black text-hoja"
                                : "rounded-md bg-mango/25 px-2 py-1 text-xs font-black text-ink"
                            }
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="mt-2 font-bold text-black/70">
                          {worker.city || "Sin ciudad"} ·{" "}
                          {worker.desired_income !== null &&
                          worker.desired_income !== undefined &&
                          worker.desired_income !== ""
                            ? formatIncomeShort(worker.desired_income)
                            : "Ingreso no especificado"}
                        </p>
                        <p className="mt-3 leading-7 text-black/75">
                          {worker.short_intro || "Sin descripcion."}
                        </p>
                        <p className="mt-2 text-xs font-bold text-black/45">
                          Creado: {worker.created_at ?? "sin fecha"}
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

                      {!worker.is_verified && (
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
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {showLocalTestWorkerAction && (
            <div className="mt-6 rounded-xl border border-dashed border-black/20 bg-white p-4 shadow-soft">
              <h2 className="text-lg font-black text-ink">
                Prueba local
              </h2>
              <p className="mt-1 font-bold text-black/60">
                Crea o aprueba un trabajador de prueba obvio para validar el
                listado y el flujo de contacto en desarrollo.
              </p>
              <form action={approveLocalTestWorker} className="mt-3">
                <button
                  type="submit"
                  className="tap-target rounded-md bg-ink px-5 py-3 font-black text-white"
                >
                  Aprobar trabajador de prueba local
                </button>
              </form>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
