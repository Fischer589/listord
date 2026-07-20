import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── Data fetching ────────────────────────────────────────────────────────────────────────────────────────────────────────

async function getDashboardStats() {
  noStore();
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalWorkers    },
    { count: pendingWorkers  },
    { count: approvedWorkers },
    { count: newThisWeek     },
    { count: totalContacts   },
    { count: contactsToday   },
    { count: totalEmployers  },
    { count: premiumEmployers },
    { count: activeBoostedWorkers },
    { data: paidBoosts },
  ] = await Promise.all([
    supabase.from("workers").select("*", { count: "exact", head: true }),
    supabase.from("workers").select("*", { count: "exact", head: true }).eq("is_verified", false),
    supabase.from("workers").select("*", { count: "exact", head: true }).eq("is_verified", true),
    supabase.from("workers").select("*", { count: "exact", head: true }).gte("created_at", startOfWeek),
    supabase.from("contact_attempts").select("*", { count: "exact", head: true }),
    supabase.from("contact_attempts").select("*", { count: "exact", head: true }).gte("created_at", startOfToday),
    supabase.from("employers").select("*", { count: "exact", head: true }),
    supabase.from("employers").select("*", { count: "exact", head: true }).eq("is_paid_employer", true),
    supabase.from("workers").select("*", { count: "exact", head: true }).eq("is_verified", true).gt("boost_expires_at", now.toISOString()),
    supabase.from("worker_boosts").select("amount, worker_id, workers(city, skills)").eq("payment_status", "paid"),
  ]);

  type BoostJoinRow = {
    amount: number;
    worker_id: string;
    workers: { city: string | null; skills: string[] | null } | { city: string | null; skills: string[] | null }[] | null;
  };

  const boostRows = (paidBoosts ?? []) as unknown as BoostJoinRow[];

  function getBoostWorkerInfo(row: BoostJoinRow) {
    if (Array.isArray(row.workers)) return row.workers[0] ?? null;
    return row.workers;
  }

  const boostRevenueCents = boostRows.reduce((sum, row) => sum + (row.amount || 0), 0);

  const boostsByCity = new Map<string, number>();
  const boostsByCategory = new Map<string, number>();

  for (const row of boostRows) {
    const workerInfo = getBoostWorkerInfo(row);
    const city = workerInfo?.city?.trim() || "Sin ciudad";
    boostsByCity.set(city, (boostsByCity.get(city) || 0) + 1);

    const category = workerInfo?.skills?.[0]?.trim() || "Sin categoría";
    boostsByCategory.set(category, (boostsByCategory.get(category) || 0) + 1);
  }

  const topBoostCities = Array.from(boostsByCity.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topBoostCategories = Array.from(boostsByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    workers: {
      total:    totalWorkers    ?? 0,
      pending:  pendingWorkers  ?? 0,
      approved: approvedWorkers ?? 0,
      newWeek:  newThisWeek     ?? 0,
    },
    contacts: {
      total: totalContacts ?? 0,
      today: contactsToday ?? 0,
    },
    employers: {
      total:   totalEmployers   ?? 0,
      premium: premiumEmployers ?? 0,
    },
    boosts: {
      revenueRD: Math.round(boostRevenueCents / 100),
      totalSuccessful: boostRows.length,
      activeNow: activeBoostedWorkers ?? 0,
      topCities: topBoostCities,
      topCategories: topBoostCategories,
    },
  };
}

// ─── Components ────────────────────────────────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent ? "var(--green)" : "var(--surface)",
        borderRadius: "1rem",
        padding: "1.25rem 1.5rem",
        border: accent ? "none" : "1px solid rgba(26,61,43,0.08)",
      }}
    >
      <p
        style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: accent ? "rgba(255,255,255,0.7)" : "rgba(26,61,43,0.45)",
          marginBottom: "0.4rem",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "2.25rem",
          fontWeight: 900,
          color: accent ? "#fff" : "var(--ink)",
          lineHeight: 1,
          fontFamily: "var(--font-display)",
        }}
      >
        {value}
      </p>
      {sub && (
        <p
          style={{
            fontSize: "0.78rem",
            color: accent ? "rgba(255,255,255,0.65)" : "rgba(26,61,43,0.45)",
            marginTop: "0.3rem",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "2.5rem" }}>
      <p
        style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "var(--green)",
          marginBottom: "0.75rem",
        }}
      >
        {title}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        {children}
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-pure)" }}>
      {/* Header bar */}
      <header
        style={{
          background: "var(--ink)",
          padding: "0.75rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <span
            style={{
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontSize: "1.15rem",
              fontWeight: 400,
            }}
          >
            ListoRD Admin
          </span>
          <nav style={{ display: "flex", gap: "1rem" }}>
            <span
              style={{
                color: "rgba(255,255,255,0.9)",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            >
              Dashboard
            </span>
            <Link
              href="/admin/workers"
              style={{
                color: "rgba(255,255,255,0.5)",
                fontWeight: 600,
                fontSize: "0.85rem",
                textDecoration: "none",
              }}
            >
              Trabajadores
            </Link>
            <Link
              href="/admin/employer-requests"
              style={{
                color: "rgba(255,255,255,0.5)",
                fontWeight: 600,
                fontSize: "0.85rem",
                textDecoration: "none",
              }}
            >
              Solicitudes
            </Link>
          </nav>
        </div>
        <Link
          href="/admin/logout"
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: "0.8rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Cerrar sesión
        </Link>
      </header>

      {/* Content */}
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            fontWeight: 400,
            color: "var(--ink)",
            marginBottom: "0.25rem",
          }}
        >
          Dashboard
        </h1>
        <p style={{ color: "rgba(26,61,43,0.45)", fontSize: "0.85rem", marginBottom: "2.5rem" }}>
          {new Date().toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>

        {!stats ? (
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "1rem",
              padding: "2rem",
              textAlign: "center",
              color: "rgba(26,61,43,0.55)",
            }}
          >
            No se pudo conectar a la base de datos.
          </div>
        ) : (
          <>
            {/* Workers */}
            <Section title="Trabajadores">
              <StatCard label="Total" value={stats.workers.total} />
              <StatCard
                label="Pendientes"
                value={stats.workers.pending}
                sub="Esperando aprobación"
                accent={stats.workers.pending > 0}
              />
              <StatCard label="Aprobados" value={stats.workers.approved} sub="Visibles al público" />
              <StatCard label="Nuevos esta semana" value={stats.workers.newWeek} />
            </Section>

            {/* Contacts */}
            <Section title="Contactos">
              <StatCard label="Hoy" value={stats.contacts.today} sub="Intentos de contacto" />
              <StatCard label="Total histórico" value={stats.contacts.total} />
            </Section>

            {/* Employers */}
            <Section title="Empleadores">
              <StatCard label="Total" value={stats.employers.total} />
              <StatCard
                label="Premium activos"
                value={stats.employers.premium}
                sub="Suscripciones pagadas"
                accent={stats.employers.premium > 0}
              />
            </Section>

            {/* Boosts — admin-only, never shown publicly */}
            <Section title="Impulsos de perfil">
              <StatCard
                label="Ingresos por impulsos"
                value={`RD$${stats.boosts.revenueRD.toLocaleString("es-DO")}`}
                sub="Total histórico"
                accent={stats.boosts.revenueRD > 0}
              />
              <StatCard label="Impulsos exitosos" value={stats.boosts.totalSuccessful} />
              <StatCard
                label="Activos ahora"
                value={stats.boosts.activeNow}
                sub="Con prioridad vigente"
                accent={stats.boosts.activeNow > 0}
              />
            </Section>

            {(stats.boosts.topCities.length > 0 || stats.boosts.topCategories.length > 0) && (
              <section style={{ marginBottom: "2.5rem", display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {stats.boosts.topCities.length > 0 && (
                  <div style={{ background: "var(--surface)", borderRadius: "1rem", padding: "1.25rem 1.5rem", border: "1px solid rgba(26,61,43,0.08)" }}>
                    <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(26,61,43,0.45)", marginBottom: "0.75rem" }}>
                      Impulsos por ciudad
                    </p>
                    {stats.boosts.topCities.map(([city, count]) => (
                      <div key={city} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", padding: "0.3rem 0", color: "var(--ink)" }}>
                        <span>{city}</span>
                        <span style={{ fontWeight: 800 }}>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
                {stats.boosts.topCategories.length > 0 && (
                  <div style={{ background: "var(--surface)", borderRadius: "1rem", padding: "1.25rem 1.5rem", border: "1px solid rgba(26,61,43,0.08)" }}>
                    <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(26,61,43,0.45)", marginBottom: "0.75rem" }}>
                      Impulsos por categoría
                    </p>
                    {stats.boosts.topCategories.map(([category, count]) => (
                      <div key={category} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", padding: "0.3rem 0", color: "var(--ink)" }}>
                        <span>{category}</span>
                        <span style={{ fontWeight: 800 }}>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Quick actions */}
            <section>
              <p
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--green)",
                  marginBottom: "0.75rem",
                }}
              >
                Acciones rápidas
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <Link
                  href="/admin/workers?status=pending"
                  style={{
                    background: "var(--ink)",
                    color: "#fff",
                    padding: "0.6rem 1.25rem",
                    borderRadius: "0.625rem",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    textDecoration: "none",
                  }}
                >
                  Ver pendientes ({stats.workers.pending})
                </Link>
                <Link
                  href="/admin/workers"
                  style={{
                    background: "var(--surface)",
                    color: "var(--ink)",
                    padding: "0.6rem 1.25rem",
                    borderRadius: "0.625rem",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    textDecoration: "none",
                    border: "1px solid rgba(26,61,43,0.12)",
                  }}
                >
                  Todos los trabajadores
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
