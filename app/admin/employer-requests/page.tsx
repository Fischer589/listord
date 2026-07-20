import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { AppHeader } from "@/components/app-header";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  EMPLOYER_REQUEST_STATUSES,
  EMPLOYER_REQUEST_STATUS_LABELS,
  type EmployerRequest,
  type EmployerRequestStatus
} from "@/lib/employer-requests";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── Server Actions ──────────────────────────────────

async function updateEmployerRequestStatus(formData: FormData) {
  "use server";
  const requestId = String(formData.get("request_id") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const supabase = getSupabaseAdminClient();

  if (!requestId || !supabase) return;
  if (!EMPLOYER_REQUEST_STATUSES.includes(status as EmployerRequestStatus)) return;

  const { error } = await supabase
    .from("employer_requests")
    .update({ status })
    .eq("id", requestId);

  if (error) {
    console.warn("Employer request status update failed.", {
      code: error.code,
      requestId
    });
  }

  revalidatePath("/admin/employer-requests");
}

// ─── Data ──────────────────────────────────────────────────────────────

async function getEmployerRequests(): Promise<{
  requests: EmployerRequest[];
  countsByStatus: Record<EmployerRequestStatus, number>;
}> {
  noStore();
  const supabase = getSupabaseAdminClient();
  const emptyCounts: Record<EmployerRequestStatus, number> = {
    new: 0,
    contacted: 0,
    matching: 0,
    completed: 0
  };

  if (!supabase) return { requests: [], countsByStatus: emptyCounts };

  const { data, error } = await supabase
    .from("employer_requests")
    .select(
      `
      id, created_at, name, client_type, service_needed, category_source,
      location, description, employment_type, budget, whatsapp, email, status
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin employer requests query failed.", {
      code: error.code,
      message: error.message
    });
    return { requests: [], countsByStatus: emptyCounts };
  }

  const requests = (data ?? []) as EmployerRequest[];
  const countsByStatus = { ...emptyCounts };
  for (const request of requests) {
    if (request.status in countsByStatus) {
      countsByStatus[request.status] += 1;
    }
  }

  return { requests, countsByStatus };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────────

function tabClass(active: boolean) {
  return active
    ? "rounded-md bg-ink px-3 py-1.5 text-xs font-black text-white"
    : "rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-black/60 hover:bg-black/5";
}

function statusBadgeClass(status: EmployerRequestStatus) {
  switch (status) {
    case "new":
      return "bg-mango/30 text-ink";
    case "contacted":
      return "bg-cielo text-ink";
    case "matching":
      return "bg-hoja/15 text-hoja";
    case "completed":
      return "bg-black/10 text-black/60";
    default:
      return "bg-black/10 text-black/60";
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────────

export default async function AdminEmployerRequestsPage({
  searchParams
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams?.status ?? "all";
  const { requests, countsByStatus } = await getEmployerRequests();
  const totalCount = requests.length;

  const displayRequests =
    statusFilter === "all"
      ? requests
      : requests.filter((request) => request.status === statusFilter);

  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <section className="container py-6">

          {/* Header */}
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-hoja">Admin</p>
              <h1 className="mt-2 text-3xl font-black text-ink">Solicitudes de empleadores</h1>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/admin/dashboard"
                className="mt-1 shrink-0 rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/50 shadow-soft hover:bg-black/5"
              >
                ← Dashboard
              </a>
              <a
                href="/admin/workers"
                className="mt-1 shrink-0 rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/50 shadow-soft hover:bg-black/5"
              >
                Trabajadores
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-wide text-black/50">Total</p>
              <p className="mt-1 text-3xl font-black text-ink">{totalCount}</p>
            </div>
            {EMPLOYER_REQUEST_STATUSES.map((status) => (
              <div key={status} className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
                <p className="text-xs font-black uppercase tracking-wide text-black/50">
                  {EMPLOYER_REQUEST_STATUS_LABELS[status]}
                </p>
                <p className="mt-1 text-3xl font-black text-ink">{countsByStatus[status]}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs — newest first is the default sort from the query */}
          <div className="mb-5 flex flex-wrap gap-2">
            <a href="/admin/employer-requests" className={tabClass(statusFilter === "all")}>
              Todas ({totalCount})
            </a>
            {EMPLOYER_REQUEST_STATUSES.map((status) => (
              <a
                key={status}
                href={`/admin/employer-requests?status=${status}`}
                className={tabClass(statusFilter === status)}
              >
                {EMPLOYER_REQUEST_STATUS_LABELS[status]} ({countsByStatus[status]})
              </a>
            ))}
          </div>

          {/* Request list */}
          {displayRequests.length === 0 ? (
            <div className="rounded-xl border border-black/10 bg-white p-6 shadow-soft">
              <h2 className="text-xl font-black text-ink">No hay solicitudes</h2>
              <p className="mt-2 font-bold text-black/60">
                Cuando lleguen solicitudes de empleadores aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {displayRequests.map((request) => {
                const waLink = `https://wa.me/${request.whatsapp.replace(/\D/g, "")}`;

                return (
                  <article
                    key={request.id}
                    className="rounded-xl border border-black/10 bg-white p-4 shadow-soft"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-black text-ink">{request.name}</h2>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-black ${statusBadgeClass(request.status)}`}
                          >
                            {EMPLOYER_REQUEST_STATUS_LABELS[request.status]}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-black/65">
                          {request.client_type} · {request.location}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs font-bold text-black/35">
                        {new Date(request.created_at).toLocaleDateString("es-DO", {
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold">
                      <span className="rounded-md bg-mango/20 px-2 py-0.5 text-ink">
                        {request.service_needed}
                        {request.category_source === "otro" ? " (personalizado)" : ""}
                      </span>
                      <span className="rounded-md bg-cielo px-2 py-0.5 text-ink">
                        {request.employment_type}
                      </span>
                      {request.budget && (
                        <span className="rounded-md bg-[#f4f1ea] px-2 py-0.5 text-black/70">
                          {request.budget}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-sm leading-6 text-black/70">{request.description}</p>

                    <p className="mt-3 text-sm font-bold text-black/65">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-hoja underline decoration-hoja/30 hover:decoration-hoja"
                      >
                        {request.whatsapp}
                      </a>
                      {request.email && <> · {request.email}</>}
                    </p>

                    {/* Status update */}
                    <form
                      action={updateEmployerRequestStatus}
                      className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/5 pt-4"
                    >
                      <input type="hidden" name="request_id" value={request.id} />
                      <select
                        name="status"
                        defaultValue={request.status}
                        className="rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-bold text-ink"
                      >
                        {EMPLOYER_REQUEST_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {EMPLOYER_REQUEST_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="tap-target rounded-md bg-hoja px-4 py-2 text-xs font-black text-white hover:bg-green-dark"
                      >
                        Actualizar estado
                      </button>
                    </form>
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
