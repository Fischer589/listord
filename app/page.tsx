import { AppHeader } from "@/components/app-header";
import { FilterBar } from "@/components/filter-bar";
import { WorkerCard } from "@/components/worker-card";
import { getWorkersResult } from "@/lib/workers";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CATEGORY_PILLS = [
  { label: "🧹 Limpieza", skill: "limpieza" },
  { label: "🍳 Cocina", skill: "cocina" },
  { label: "🔧 Plomería", skill: "plomería" },
  { label: "🏗️ Construcción", skill: "construcción" },
  { label: "💡 Electricidad", skill: "electricista" },
  { label: "🎨 Pintura", skill: "pintura" },
  { label: "📚 Clases", skill: "clases" },
  { label: "💅 Belleza", skill: "manicura" }
];

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
        {/* ── HERO ── */}
        <section className="hero-section">
          <div className="container hero-inner">
            <div className="hero-message">
              <p className="hero-kicker text-sm font-black uppercase tracking-wide">
                Solo en República Dominicana 🇩🇴
              </p>
              <h1 className="hero-title text-ink">
                Encuentra trabajadores confiables hoy.
              </h1>
              <p className="hero-copy">
                Busca limpieza, construcción, cocina, plomería y más. Habla
                directo por WhatsApp.
              </p>
              <div className="hero-actions mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/empleadores"
                  className="btn-primary tap-target inline-flex min-w-0 items-center justify-center px-6 py-4 text-base text-white"
                >
                  Encontrar trabajadores
                </Link>
                <Link
                  href="/trabajadores/registro"
                  className="btn-secondary tap-target inline-flex min-w-0 items-center justify-center px-6 py-4 text-base"
                >
                  Crear mi perfil gratis
                </Link>
              </div>
              <div className="hero-badges mt-7 flex flex-wrap gap-2 text-sm font-black text-ink">
                <span className="trust-badge px-3.5 py-2">✓ Verificados</span>
                <span className="trust-badge px-3.5 py-2">
                  WhatsApp directo
                </span>
                <span className="trust-badge px-3.5 py-2">1 gratis al día</span>
              </div>
            </div>
            <div className="trust-panel">
              <div className="hero-proof-card">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-hoja">
                    Disponible hoy
                  </p>
                  <p className="mt-1 text-xl font-black leading-tight text-ink">
                    Limpieza · Plomería · Cocina · Construcción · Más
                  </p>
                </div>
                <span className="hero-proof-status">Verificado</span>
              </div>
              <div className="hero-proof-list">
                <div>
                  <span>1</span>
                  Filtra por ciudad y servicio
                </div>
                <div>
                  <span>2</span>
                  Revisa perfiles reales
                </div>
                <div>
                  <span>3</span>
                  Contacta directo por WhatsApp
                </div>
              </div>
              <div className="hero-proof-footer">
                <p>1 contacto gratis</p>
                <Link href="/empleadores">Empezar ahora →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── CATEGORY QUICK-FILTERS ── */}
        <section className="container category-section">
          <p className="mb-4 text-sm font-black uppercase tracking-wide text-hoja">
            ¿Qué necesitas?
          </p>
          <div className="category-pill-row">
            {CATEGORY_PILLS.map(({ label, skill }) => (
              <Link
                key={skill}
                href={`/?skill=${encodeURIComponent(skill)}`}
                className={`category-pill${searchParams.skill === skill ? " category-pill--active" : ""}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        {/* ── FILTER BAR ── */}
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

        {/* ── WORKER GRID ── */}
        <section className="container workers-section">
          {(!workersResult.ok || hasWorkers) && (
            <div className="section-heading">
              <div>
                <h2 className="text-2xl font-black text-ink">
                  Trabajadores disponibles ahora
                </h2>
                <p className="mt-1 text-sm font-bold text-ink/55">
                  Perfiles revisados y listos para trabajar hoy
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
                <p className="text-4xl">🇩🇴</p>
                <h3 className="mt-3 text-2xl font-black text-ink">
                  Estamos agregando trabajadores verificados en RD.
                </h3>
                <p className="mx-auto mt-2 max-w-xl leading-7 text-ink/70">
                  ¿Ofreces un servicio? Crea tu perfil gratis y empieza a
                  recibir oportunidades por WhatsApp hoy mismo.
                </p>
                <Link
                  href="/trabajadores/registro"
                  className="btn-primary tap-target mt-5 inline-flex items-center justify-center px-6 py-3 text-lg text-white"
                >
                  Crear mi perfil gratis
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── TRUST SECTION ── */}
        <section className="container trust-section">
          <p className="mb-5 text-center text-sm font-black uppercase tracking-wide text-hoja">
            ¿Por qué ListoRD?
          </p>
          <div className="trust-section-grid">
            <div className="trust-item">
              <span className="trust-item-icon">✓</span>
              <h3 className="trust-item-title">Perfiles verificados</h3>
              <p className="trust-item-body">
                Cada perfil es revisado manualmente por el equipo de ListoRD
                antes de publicarse.
              </p>
            </div>
            <div className="trust-item">
              <span className="trust-item-icon">💬</span>
              <h3 className="trust-item-title">Contacto directo por WhatsApp</h3>
              <p className="trust-item-body">
                Sin intermediarios. Hablas directamente con la persona.
                Un contacto gratis cada día.
              </p>
            </div>
            <div className="trust-item">
              <span className="trust-item-icon">🇩🇴</span>
              <h3 className="trust-item-title">Hecho para RD</h3>
              <p className="trust-item-body">
                Diseñado para el mercado dominicano. Trabajadores reales, en tu
                ciudad, disponibles hoy.
              </p>
            </div>
          </div>
        </section>

        {/* ── WORKER CTA BANNER ── */}
        <section className="container worker-cta-banner">
          <div className="worker-cta-inner">
            <div>
              <h2 className="text-2xl font-black text-ink">
                ¿Ofreces un servicio?
              </h2>
              <p className="mt-2 leading-7 text-ink/70">
                Crea tu perfil gratis y hazte visible en tu ciudad. Los clientes
                te contactan directo por WhatsApp.
              </p>
            </div>
            <Link
              href="/trabajadores/registro"
              className="btn-primary tap-target inline-flex shrink-0 items-center justify-center px-6 py-4 text-base text-white"
            >
              Crear mi perfil gratis
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
