import { AppHeader } from "@/components/app-header";
import { FilterBar } from "@/components/filter-bar";
import { WorkerCard } from "@/components/worker-card";
import { getWorkers } from "@/lib/workers";

export default async function Home({
  searchParams
}: {
  searchParams: {
    city?: string;
    skill?: string;
    income?: string;
    availableNow?: string;
    workStyle?: string;
  };
}) {
  const workers = await getWorkers(searchParams);

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
                Conecta con gente seria, disponible y cerca de ti.
              </p>
            </div>
            <div className="trust-panel">
              <p className="text-sm font-black text-ink">Aquí importa cumplir</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-md bg-[#f4f1ea] p-3 font-bold">Llegó</div>
                <div className="rounded-md bg-[#f4f1ea] p-3 font-bold">Respondió</div>
                <div className="rounded-md bg-[#f4f1ea] p-3 font-bold">Cumplió</div>
              </div>
            </div>
          </div>
        </section>

        <section className="container filter-section">
          <div className="mb-4 rounded-xl bg-hoja px-4 py-3 text-sm font-black text-white shadow-soft">
            Encuentra personas listas para trabajar hoy en minutos.
          </div>
          <FilterBar
            city={searchParams.city}
            skill={searchParams.skill}
            income={searchParams.income}
            availableNow={searchParams.availableNow}
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
            <h2 className="text-xl font-black">Gente disponible ahora</h2>
            <span className="text-sm font-bold text-black/55">
              {workers.length} resultados
            </span>
          </div>
          <div className="worker-grid">
            {workers.length > 0 ? (
              workers.map((worker) => (
                <WorkerCard key={worker.id} worker={worker} />
              ))
            ) : (
              <div className="rounded-xl border border-black/10 bg-white p-6 shadow-soft md:col-span-2 lg:col-span-3">
                <h3 className="text-xl font-black">
                  Pronto habrá más personas disponibles.
                </h3>
                <p className="mt-2 max-w-xl leading-7 text-black/70">
                  Intenta cambiar los filtros.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
