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
              <p className="text-sm font-black uppercase tracking-wide text-hoja">
                Realidad &gt; palabras
              </p>
              <h1 className="hero-title text-ink">
                Trabajadores listos para trabajar hoy
              </h1>
              <p className="hero-copy">
                Trabajadores reales, disponibles ahora mismo en tu ciudad. Mira
                cuánto quieren ganar, cuándo pueden trabajar y qué saben hacer.
              </p>
              <p className="mt-4 text-lg font-bold leading-8 text-ink">
                Trabajadores disponibles ahora. Responden en menos de 10 minutos.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/empleadores"
                  className="tap-target inline-flex items-center justify-center rounded-xl bg-ink px-6 py-4 text-base font-black text-white shadow-soft transition hover:bg-hoja"
                >
                  Necesito gente
                </Link>
                <Link
                  href="/trabajadores/registro"
                  className="tap-target inline-flex items-center justify-center rounded-xl border border-hoja/15 bg-card px-6 py-4 text-base font-black text-ink shadow-soft transition hover:border-hoja/30 hover:bg-white"
                >
                  Busco trabajo
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 text-sm font-black text-ink">
                <span className="rounded-lg border border-hoja/10 bg-card px-3 py-2 shadow-soft">
                  Perfiles verificados
                </span>
                <span className="rounded-lg border border-hoja/10 bg-card px-3 py-2 shadow-soft">
                  Respuesta en minutos
                </span>
                <span className="rounded-lg border border-hoja/10 bg-card px-3 py-2 shadow-soft">
                  Contacto directo por WhatsApp
                </span>
              </div>
            </div>
            <div className="trust-panel">
              <p className="text-sm font-black text-ink">
                Quedan pocos trabajadores disponibles hoy
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-crema p-3 font-bold text-ink/80">Verificado</div>
                <div className="rounded-lg bg-crema p-3 font-bold text-ink/80">Responde</div>
                <div className="rounded-lg bg-crema p-3 font-bold text-ink/80">WhatsApp</div>
              </div>
            </div>
          </div>
        </section>

        <section className="container filter-section">
          <div className="mb-5 rounded-xl bg-hoja px-4 py-3.5 text-sm font-black text-white shadow-soft">
            Trabajadores disponibles ahora. Responden en menos de 10 minutos.
          </div>
          <FilterBar
            city={searchParams.city}
            skill={searchParams.skill}
            income={searchParams.income}
            workStyle={searchParams.workStyle}
          />
        </section>

        <section className="container workers-section">
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-hoja/10 bg-card p-3 text-center text-sm font-black shadow-soft sm:grid-cols-4">
            <div className="rounded-xl bg-crema px-3 py-3 text-ink/80">Llegó</div>
            <div className="rounded-xl bg-crema px-3 py-3 text-ink/80">Cumplió</div>
            <div className="rounded-xl bg-crema px-3 py-3 text-ink/80">Respondió</div>
            <div className="rounded-xl bg-crema px-3 py-3 text-ink/80">Fue contratado</div>
          </div>
          {(!workersResult.ok || hasWorkers) && (
            <div className="section-heading">
              <div>
                <h2 className="text-xl font-black">
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
                  className="tap-target mt-5 inline-flex items-center justify-center rounded-xl bg-hoja px-6 py-3 font-black text-white shadow-soft transition hover:bg-ink"
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
                  className="tap-target mt-5 inline-flex items-center justify-center rounded-xl bg-hoja px-6 py-3 text-lg font-black text-white shadow-soft transition hover:bg-ink"
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
