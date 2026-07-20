import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import Image from "next/image";
import { AppHeader } from "@/components/app-header";
import { formatIncomeShort, workStyleLabels } from "@/lib/format";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Worker } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── Server Actions ──────────────────

async function approveWorker(formData: FormData) {
  "use server";
  const workerId = String(formData.get("worker_id") || "").trim();
  const supabase = getSupabaseAdminClient();
  if (!workerId || !supabase) return;
  const { error } = await supabase
    .from("workers")
    .update({ is_verified: true })
    .eq("id", workerId);
  if (error) console.warn("Worker approval failed.", { code: error.code, workerId });
  revalidatePath("/admin/workers");
  revalidatePath("/");
}

async function rejectWorker(formData: FormData) {
  "use server";
  // Only deletes unverified (pending) workers — safety guard
  const workerId = String(formData.get("worker_id") || "").trim();
  const supabase = getSupabaseAdminClient();
  if (!workerId || !supabase) return;
  const { error } = await supabase
    .from("workers")
    .delete()
    .eq("id", workerId)
    .eq("is_verified", false);
  if (error) console.warn("Worker rejection failed.", { code: error.code, workerId });
  revalidatePath("/admin/workers");
  revalidatePath("/");
}

async function deactivateWorker(formData: FormData) {
  "use server";
  const workerId = String(formData.get("worker_id") || "").trim();
  const supabase = getSupabaseAdminClient();
  if (!workerId || !supabase) return;
  const { error } = await supabase
    .from("workers")
    .update({ is_verified: false })
    .eq("id", workerId);
  if (error) console.warn("Worker deactivation failed.", { code: error.code, workerId });
  revalidatePath("/admin/workers");
  revalidatePath("/");
}

async function approveLocalTestWorker() {
  "use server";
  if (process.env.NODE_ENV === "production") return;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
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
    console.warn("Local test worker lookup failed.", { code: lookupError.code });
    return;
  }
  const response = existingWorker?.id
    ? await supabase.from("workers").update(testWorker).eq("id", existingWorker.id)
    : await supabase.from("workers").insert(testWorker);
  if (response.error) {
    console.warn("Local test worker approval failed.", { code: response.error.code });
  }
  revalidatePath("/admin/workers");
  revalidatePath("/");
}

// ─── Data ──────────────────────────────────────────────────

type AdminWorkersResult = {
  approvedCount: number;
  pendingCount: number;
  workers: Worker[];
};

async function getAdminWorkers(): Promise<AdminWorkersResult> {
  noStore();
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { approvedCount: 0, pendingCount: 0, workers: [] };

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
      created_at
    `)
    .order("created_at", { ascending: false });

  const pendingQ = supabase
    .from("workers")
    .select("id", { count: "exact", head: true })
    .eq("is_verified", false);

  const approvedQ = supabase
    .from("workers")
    .select("id", { count: "exact", head: true })
    .eq("is_verified", true);

  try {
    const [{ data, error }, { count: pc }, { count: ac }] = await Promise.all([
      workersQuery,
      pendingQ,
      approvedQ
    ]);

    if (error) {
      console.warn("Admin workers query failed.", { code: error.code, message: error.message });
      return { approvedCount: 0, pendingCount: 0, workers: [] };
    }

    const workers = (data ?? []).map((w) => ({ ...w, is_verified: Boolean(w.is_verified) }));
    const fallbackPending = workers.filter((w) => !w.is_verified).length;
    const fallbackApproved = workers.filter((w) => w.is_verified).length;

    return {
      approvedCount: ac ?? fallbackApproved,
      pendingCount: pc ?? fallbackPending,
      workers
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Admin workers query threw unexpectedly.", msg);
    return { approvedCount: 0, pendingCount: 0, workers: [] };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function tabClass(active: boolean) {
  return active
    ? "rounded-md bg-ink px-3 py-1.5 text-xs font-black text-white"
    : "rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-black/60 hover:bg-black/5";
}

// ─── Page ──────────────────────────────────────────────────────

export default async function AdminWorkersPage({
  searchParams
}: {
  searchParams: { status?: string }
}) {
  const statusFilter = searchParams?.status ?? "all";
  const { approvedCount, pendingCount, workers } = await getAdminWorkers();
  const totalCount = workers.length;
  const showLocalTestWorkerAction = process.env.NODE_ENV !== "production";

  const displayWorkers = workers.filter((w) => {
    if (statusFilter === "pending") return !w.is_verified;
    if (statusFilter === "approved") return w.is_verified;
    return true;
  });

  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <section className="container py-6">

          {/* Header */}
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-hoja">Admin</p>
              <h1 className="mt-2 text-3xl font-black text-ink">Trabajadores registrados</h1>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/admin/dashboard"
                className="mt-1 shrink-0 rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/50 shadow-soft hover:bg-black/5"
              >
                ← Dashboard
              </a>
              <a
                href="/admin/employer-requests"
                className="mt-1 shrink-0 rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/50 shadow-soft hover:bg-black/5"
              >
                Solicitudes
              </a>
              <a
                href="/admin/employer-payments"
                className="mt-1 shrink-0 rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/50 shadow-soft hover:bg-black/5"
              >
                Depósitos
              </a>
              <a
                href="/admin/logout"
                className="mt-1 shrink-0 rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/50 shadow-soft hover:bg-black/5"
              >
                Cerrar sesión
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-wide text-black/50">Total</p>
              <p className="mt-1 text-3xl font-black text-ink">{totalCount}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-wide text-black/50">Pendientes</p>
              <p className="mt-1 text-3xl font-black text-ink">{pendingCount}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-wide text-black/50">Aprobados</p>
              <p className="mt-1 text-3xl font-black text-ink">{approvedCount}</p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="mb-5 flex flex-wrap gap-2">
            <a href="/admin/workers" className={tabClass(statusFilter === "all" || !searchParams?.status)}>
              Todos ({totalCount})
            </a>
            <a href="/admin/workers?status=pending" className={tabClass(statusFilter === "pending")}>
              Pendientes ({pendingCount})
            </a>
            <a href="/admin/workers?status=approved" className={tabClass(statusFilter === "approved")}>
              Aprobados ({approvedCount})
            </a>
          </div>

          {/* Worker list */}
          {displayWorkers.length === 0 ? (
            <div className="rounded-xl border border-black/10 bg-white p-6 shadow-soft">
              <h2 className="text-xl font-black text-ink">
                {statusFilter === "pending"
                  ? "No hay trabajadores pendientes"
                  : statusFilter === "approved"
                  ? "No hay trabajadores aprobados"
                  : "No hay trabajadores cargados"}
              </h2>
              <p className="mt-2 font-bold text-black/60">
                Cuando lleguen registros aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {displayWorkers.map((worker) => {
                const skills = Array.isArray(worker.skills) ? worker.skills : [];
                const availability = Array.isArray(worker.availability) ? worker.availability : [];
                const workStyle =
                  worker.work_style && worker.work_style in workStyleLabels
                    ? workStyleLabels[worker.work_style]
                    : null;
                const initials = getInitials(worker.full_name);
                const waLink = worker.whatsapp_number
                  ? `https://wa.me/${worker.whatsapp_number.replace(/\D/g, "")}`
                  : null;
                const profileSlug = worker.id;

                return (
                  <article
                    key={worker.id}
                    className="rounded-xl border border-black/10 bg-white p-4 shadow-soft"
                  >
                    <div className="flex gap-4">

                      {/* Photo */}
                      <div className="shrink-0">
                        {worker.photo_url ? (
                          <div className="relative h-16 w-16 overflow-hidden rounded-lg">
                            <Image
                              src={worker.photo_url}
                              alt={worker.full_name ?? ""}
                              fill
                              className="object-cover"
                              sizes="64px"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-cielo text-lg font-black text-hoja">
                            {initials}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-black text-ink">
                            {worker.full_name || "Sin nombre"}
                          </h2>
                          <span
                            className={
                              worker.is_verified
                                ? "rounded-md bg-hoja/15 px-2 py-0.5 text-xs font-black text-hoja"
                                : "rounded-md bg-mango/30 px-2 py-0.5 text-xs font-black text-ink"
                            }
                          >
                            {worker.is_verified ? "Aprobado" : "Pendiente"}
                          </span>
                        </div>

                        <p className="mt-1 text-sm font-bold text-black/65">
                          {worker.city || "Sin ciudad"}
                          {worker.desired_income !== null &&
                          worker.desired_income !== undefined &&
                          worker.desired_income !== "" ? (
                            <> · {formatIncomeShort(worker.desired_income)}</>
                          ) : null}
                          {waLink ? (
                            <> · <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-hoja underline decoration-hoja/30 hover:decoration-hoja">{worker.whatsapp_number}</a></>
                          ) : (
                            <> · <span className="text-black/35">Sin WhatsApp</span></>
                          )}
                        </p>

                        {worker.short_intro && (
                          <p className="mt-2 text-sm leading-6 text-black/70">
                            {worker.short_intro}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
                          {skills.map((skill) => (
                            <span key={skill} className="rounded-md bg-mango/20 px-2 py-0.5 text-ink">{skill}</span>
                          ))}
                          {availability.map((item) => (
                            <span key={item} className="rounded-md bg-cielo px-2 py-0.5 text-ink">{item}</span>
                          ))}
                          {workStyle && (
                            <span className="rounded-md bg-[#f4f1ea] px-2 py-0.5 text-black/70">{workStyle}</span>
                          )}
                        </div>

                        <p className="mt-2 text-xs font-bold text-black/35">
                          Registrado: {worker.created_at ? new Date(worker.created_at).toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "numeric" }) : "sin fecha"}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/5 pt-4">
                      {worker.is_verified ? (
                        <a
                          href={`/trabajador/${profileSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/55 hover:bg-black/5"
                        >
                          Ver perfil ↗
                        </a>
                      ) : (
                        <span className="rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/25 cursor-default select-none">
                          Sin perfil público
                        </span>
                      )}

                      {!worker.is_verified ? (
                        <>
                          <form action={approveWorker} className="inline">
                            <input type="hidden" name="worker_id" value={worker.id} />
                            <button
                              type="submit"
                              className="tap-target rounded-md bg-hoja px-4 py-2 text-xs font-black text-white hover:bg-green-dark"
                            >
                              Aprobar
                            </button>
                          </form>
                          <form action={rejectWorker} className="inline">
                            <input type="hidden" name="worker_id" value={worker.id} />
                            <button
                              type="submit"
                              className="tap-target rounded-md border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                            >
                              Rechazar y eliminar
                            </button>
                          </form>
                        </>
                      ) : (
                        <form action={deactivateWorker} className="inline">
                          <input type="hidden" name="worker_id" value={worker.id} />
                          <button
                            type="submit"
                            className="tap-target rounded-md border border-black/15 bg-mango/20 px-4 py-2 text-xs font-black text-ink hover:bg-mango/35"
                          >
                            Desactivar
                          </button>
                        </form>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Local dev test worker */}
          {showLocalTestWorkerAction && (
            <div className="mt-6 rounded-xl border border-dashed border-black/20 bg-white p-4 shadow-soft">
              <h2 className="text-lg font-black text-ink">Prueba local</h2>
              <p className="mt-1 text-sm font-bold text-black/60">
                Crea o aprueba un trabajador de prueba para validar listado y contacto en desarrollo.
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
