import { unstable_noStore as noStore } from "next/cache";
import { AppHeader } from "@/components/app-header";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  EMPLOYER_PAYMENT_STATUS_LABELS,
  type EmployerPayment,
  type EmployerPaymentStatus
} from "@/lib/employer-deposit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── Data ───────────────────────────────────────────────────────────

async function getEmployerPayments(): Promise<{
  payments: EmployerPayment[];
  totalPaidRD: number;
}> {
  noStore();
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { payments: [], totalPaidRD: 0 };

  const { data, error } = await supabase
    .from("employer_payments")
    .select(
      `
      id, created_at, stripe_payment_id, stripe_session_id, amount, currency,
      status, customer_name, customer_email, customer_phone, paid_at
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin employer payments query failed.", {
      code: error.code,
      message: error.message
    });
    return { payments: [], totalPaidRD: 0 };
  }

  const payments = (data ?? []) as EmployerPayment[];
  const totalPaidCents = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return { payments, totalPaidRD: Math.round(totalPaidCents / 100) };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function statusBadgeClass(status: EmployerPaymentStatus) {
  switch (status) {
    case "paid":
      return "bg-hoja/15 text-hoja";
    case "pending":
      return "bg-mango/30 text-ink";
    case "failed":
      return "bg-red-100 text-red-700";
    case "refunded":
      return "bg-black/10 text-black/60";
    default:
      return "bg-black/10 text-black/60";
  }
}

// ─── Page ───────────────────────────────────────────────────────────

export default async function AdminEmployerPaymentsPage() {
  const { payments, totalPaidRD } = await getEmployerPayments();
  const paidCount = payments.filter((p) => p.status === "paid").length;
  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <section className="container py-6">

          {/* Header */}
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-hoja">Admin</p>
              <h1 className="mt-2 text-3xl font-black text-ink">Depósitos de empleadores</h1>
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
            </div>
          </div>

          {/* Stats */}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-wide text-black/50">Total recaudado</p>
              <p className="mt-1 text-3xl font-black text-ink">RD${totalPaidRD.toLocaleString("es-DO")}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-wide text-black/50">Pagados</p>
              <p className="mt-1 text-3xl font-black text-ink">{paidCount}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-wide text-black/50">Pendientes</p>
              <p className="mt-1 text-3xl font-black text-ink">{pendingCount}</p>
            </div>
          </div>

          {/* Payment list */}
          {payments.length === 0 ? (
            <div className="rounded-xl border border-black/10 bg-white p-6 shadow-soft">
              <h2 className="text-xl font-black text-ink">No hay depósitos todavía</h2>
              <p className="mt-2 font-bold text-black/60">
                Cuando lleguen pagos de empleadores aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {payments.map((payment) => (
                <article
                  key={payment.id}
                  className="rounded-xl border border-black/10 bg-white p-4 shadow-soft"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black text-ink">
                          {payment.customer_name || "Sin nombre"}
                        </h2>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-black ${statusBadgeClass(payment.status)}`}
                        >
                          {EMPLOYER_PAYMENT_STATUS_LABELS[payment.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-black/65">
                        {payment.customer_email || "Sin email"}
                        {payment.customer_phone ? ` · ${payment.customer_phone}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-2xl font-black text-ink">
                      RD${Math.round(payment.amount / 100).toLocaleString("es-DO")}
                    </p>
                  </div>

                  <p className="mt-3 text-xs font-bold text-black/45">
                    {new Date(payment.created_at).toLocaleDateString("es-DO", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                    {payment.paid_at &&
                      ` · Pagado: ${new Date(payment.paid_at).toLocaleDateString("es-DO", {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}`}
                  </p>

                  {payment.stripe_payment_id && (
                    <p className="mt-1 break-all text-xs font-semibold text-black/40">
                      Stripe: {payment.stripe_payment_id}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}

        </section>
      </main>
    </>
  );
}
