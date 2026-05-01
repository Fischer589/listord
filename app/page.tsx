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
  const diagnostics = workersResult.diagnostics;

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
                Personas reales, disponibles ahora mismo en tu ciudad. Mira
                cuánto quieren ganar, cuándo pueden trabajar y qué saben hacer.
              </p>
              <p className="mt-3 text-lg font-bold text-ink">
                Personas disponibles ahora. Responden en menos de 10 minutos.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-sm font-black text-ink">
                <span className="rounded-md bg-white px-3 py-2 shadow-soft">
                  Perfiles verificados
                </span>
                <span className="rounded-md bg-white px-3 py-2 shadow-soft">
                  Respuesta en minutos
                </span>
                <span className="rounded-md bg-white px-3 py-2 shadow-soft">
                  Contacto directo por WhatsApp
                </span>
              </div>
            </div>
            <div className="trust-panel">
              <p className="text-sm font-black text-ink">
                Quedan pocos trabajadores disponibles hoy
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-md bg-[#f4f1ea] p-3 font-bold">Verificado</div>
                <div className="rounded-md bg-[#f4f1ea] p-3 font-bold">Responde</div>
                <div className="rounded-md bg-[#f4f1ea] p-3 font-bold">WhatsApp</div>
              </div>
            </div>
          </div>
        </section>

        <section className="container filter-section">
          <div className="mb-4 rounded-xl bg-hoja px-4 py-3 text-sm font-black text-white shadow-soft">
            Personas disponibles ahora. Responden en menos de 10 minutos.
          </div>
          <FilterBar
            city={searchParams.city}
            skill={searchParams.skill}
            income={searchParams.income}
            workStyle={searchParams.workStyle}
          />
        </section>

        <section className="container workers-section">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-white p-3 text-center text-sm font-black shadow-soft sm:grid-cols-4">
            <div className="rounded-lg bg-[#f4f1ea] px-3 py-3">Llegó</div>
            <div className="rounded-lg bg-[#f4f1ea] px-3 py-3">Cumplió</div>
            <div className="rounded-lg bg-[#f4f1ea] px-3 py-3">Respondió</div>
            <div className="rounded-lg bg-[#f4f1ea] px-3 py-3">Fue contratado</div>
          </div>
          <div className="section-heading">
            <div>
              <h2 className="text-xl font-black">Personas disponibles ahora</h2>
              <p className="mt-1 text-sm font-bold text-black/55">
                Quedan pocos trabajadores disponibles hoy
              </p>
              <p className="mt-2 rounded-md bg-mango/20 px-3 py-2 text-xs font-black text-ink">
                Verified workers loaded: {workers.length}
              </p>
              <div className="mt-3 rounded-lg border border-mango/40 bg-white p-3 text-left text-xs font-bold text-ink shadow-soft">
                <p className="font-black uppercase tracking-wide text-hoja">
                  Temporary homepage diagnostics
                </p>
                <dl className="mt-2 grid gap-1">
                  <div>
                    <dt className="inline font-black">Supabase host: </dt>
                    <dd className="inline">{diagnostics.supabaseUrlHost}</dd>
                  </div>
                  <div>
                    <dt className="inline font-black">
                      Public total workers count:{" "}
                    </dt>
                    <dd className="inline">{diagnostics.totalWorkerCount}</dd>
                  </div>
                  <div>
                    <dt className="inline font-black">
                      Verified workers count:{" "}
                    </dt>
                    <dd className="inline">
                      {diagnostics.verifiedWorkerCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-black">
                      First 5 homepage query names:{" "}
                    </dt>
                    <dd className="inline">
                      {diagnostics.homepageWorkerNames.length > 0
                        ? diagnostics.homepageWorkerNames.join(", ")
                        : "none"}
                    </dd>
                  </div>
                  {diagnostics.queryErrorMessage ? (
                    <div>
                      <dt className="inline font-black text-red-700">
                        Query error:{" "}
                      </dt>
                      <dd className="inline text-red-700">
                        {diagnostics.queryErrorMessage}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </div>
            <span className="text-sm font-bold text-black/55">
              {workers.length} resultados
            </span>
          </div>
          <div className="worker-grid">
            {!workersResult.ok ? (
              <div className="empty-state md:col-span-2 lg:col-span-3">
                <p className="text-sm font-black uppercase tracking-wide text-hoja">
                  Conexión interrumpida
                </p>
                <h3 className="mt-2 text-2xl font-black text-ink">
                  No pudimos cargar los trabajadores ahora mismo.
                </h3>
                <p className="mx-auto mt-2 max-w-xl leading-7 text-black/70">
                  Intenta de nuevo en unos minutos. Estamos manteniendo los
                  perfiles seguros y verificados.
                </p>
                <Link
                  href="/"
                  className="tap-target mt-5 inline-flex items-center justify-center rounded-md bg-hoja px-6 py-3 font-black text-white shadow-soft"
                >
                  Intentar de nuevo
                </Link>
              </div>
            ) : workers.length > 0 ? (
              workers.map((worker) => (
                <WorkerCard key={worker.id} worker={worker} />
              ))
            ) : (
              <div className="empty-state md:col-span-2 lg:col-span-3">
                <p className="text-sm font-black uppercase tracking-wide text-hoja">
                  Lanzamiento en progreso
                </p>
                <h3 className="mt-2 text-2xl font-black text-ink">
                  Estamos verificando trabajadores reales en tu zona.
                </h3>
                <p className="mx-auto mt-2 max-w-xl leading-7 text-black/70">
                  Estamos verificando trabajadores reales. Déjanos saber qué
                  necesitas y te ayudamos.
                </p>
                <p className="mt-4 text-lg font-black text-ink">
                  ¿Quieres registrarte para aparecer en ListoRD?
                </p>
                <Link
                  href="/trabajadores/registro"
                  className="tap-target mt-5 inline-flex items-center justify-center rounded-md bg-hoja px-6 py-3 text-lg font-black text-white shadow-soft"
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
