import { AppHeader } from "@/components/app-header";
import { FilterBar } from "@/components/filter-bar";
import { WorkerCard } from "@/components/worker-card";
import { getWorkersResult } from "@/lib/workers";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home({
  searchParams
}: {
  searchParams: {
    city?: string;
    skill?: string;
    income?: string;
    workStyle?: string;
  };
}) {
  const workersResult = await getWorkersResult(searchParams);
  const workers = workersResult.workers;
  const hasWorkers = workers.length > 0;

  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <section className="hero-section">
          <div className="container hero-inner">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-hoja/90">
                Trabajadores verificados en RD
              </p>
              <h1 className="hero-title text-ink">
                Contrata trabajadores verificados por WhatsApp.
              </h1>
              <p className="hero-copy">
                Encuentra personas reales en RD, disponibles para trabajar hoy.
                1 contacto gratis.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/empleadores"
                  className="btn-primary tap-target inline-flex min-w-0 items-center justify-center px-6 py-4 text-base text-white"
                >
                  Necesito gente
                </Link>
                <Link
                  href="/trabajadores/registro"
                  className="btn-secondary tap-target inline-flex min-w-0 items-center justify-center px-6 py-4 text-base"
                >
                  Busco trabajo
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-2 text-sm font-black text-ink">
                <span className="trust-badge px-3.5 py-2">
                  Verificados
                </span>
                <span className="trust-badge px-3.5 py-2">
                  Contacto directo
                </span>
                <span className="trust-badge px-3.5 py-2">
                  Listos para hoy
                </span>
              </div>
            </div>
            <div className="trust-panel">
              <p className="text-xs font-black uppercase tracking-wide text-hoja">
                Contratacion directa
              </p>
              <p className="mt-3 text-2xl font-black leading-tight text-ink">
                Ve quien esta disponible antes de escribir.
              </p>
              <p className="mt-3 text-sm font-bold leading-6 text-ink/60">
                Ciudad, habilidades, ingreso esperado y disponibilidad en un
                perfil simple.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-black">
                <div className="trust-badge px-3 py-3">RD</div>
                <div className="trust-badge px-3 py-3">Hoy</div>
                <div className="trust-badge px-3 py-3">WhatsApp</div>
              </div>
            </div>
          </div>
        </section>

        <section className="container filter-section">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-hoja">
                Explora perfiles
              </p>
              <h2 className="mt-1 text-2xl font-black text-ink">
                Filtra por lo que necesitas hoy
              </h2>
            </div>
            <p className="max-w-md text-sm font-bold leading-6 text-ink/60">
              Resultados limpios para encontrar trabajadores disponibles sin
              perder tiempo.
            </p>
          </div>
          <FilterBar
            city={searchParams.city}
            skill={searchParams.skill}
            income={searchParams.income}
            workStyle={searchParams.workStyle}
          />
        </section>

        <section className="container workers-section">
          <div className="mb-8 grid grid-cols-2 gap-2 rounded-3xl border border-[rgba(31,31,28,0.06)] bg-card/80 p-2.5 text-center text-sm font-black shadow-soft sm:grid-cols-4">
            <div className="trust-badge px-3 py-3">Llegó</div>
            <div className="trust-badge px-3 py-3">Cumplió</div>
            <div className="trust-badge px-3 py-3">Respondió</div>
            <div className="trust-badge px-3 py-3">Fue contratado</div>
          </div>
          {(!workersResult.ok || hasWorkers) && (
            <div className="section-heading">
              <div>
                <h2 className="text-2xl font-black text-ink">
                  Trabajadores disponibles ahora
                </h2>
                <p className="mt-1 text-sm font-bold text-ink/55">
                  Quedan pocos trabajadores disponibles hoy
                </p>
              </div>
            </div>
          )}
          <div className="worker-grid">
            {!workersResult.ok ? (
              <div className="empty-state md:col-span-2 lg:col-span-3">
                <p className="text-sm font-black uppercase tracking-wide text-hoja">
                  Conexión interrumpida
                </p>
                <h3 className="mt-2 text-2xl font-black text-ink">
                  No pudimos cargar los trabajadores ahora mismo.
                </h3>
                <p className="mx-auto mt-2 max-w-xl leading-7 text-ink/70">
                  Intenta de nuevo en unos minutos. Estamos manteniendo los
                  perfiles seguros y verificados.
                </p>
                <Link
                  href="/"
                  className="btn-primary tap-target mt-5 inline-flex items-center justify-center px-6 py-3 text-white"
                >
                  Intentar de nuevo
                </Link>
              </div>
            ) : hasWorkers ? (
              workers.map((worker) => (
                <WorkerCard key={worker.id} worker={worker} />
              ))
            ) : (
              <div className="empty-state md:col-span-2 lg:col-span-3">
                <h3 className="mt-2 text-2xl font-black text-ink">
                  Estamos agregando trabajadores verificados en RD.
                </h3>
                <p className="mx-auto mt-2 max-w-xl leading-7 text-ink/70">
                  ¿Buscas trabajo? Regístrate gratis para aparecer en ListoRD y
                  recibir oportunidades por WhatsApp.
                </p>
                <Link
                  href="/trabajadores/registro"
                  className="btn-primary tap-target mt-5 inline-flex items-center justify-center px-6 py-3 text-lg text-white"
                >
                  Registrarme como trabajador
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
