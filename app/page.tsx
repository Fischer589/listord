import { AppHeader } from "@/components/app-header";
import { FilterBar } from "@/components/filter-bar";
import { WorkerCard } from "@/components/worker-card";
import { getWorkersResult } from "@/lib/workers";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Each pill maps directly to a /categorias/[slug] SEO page
const CATEGORY_PILLS = [
  { label: "🧹 Limpieza",     slug: "limpiadora"   },
  { label: "🍳 Cocina",       slug: "cocinera"     },
  { label: "🔧 Plomería",     slug: "plomero"      },
  { label: "🏗️ Construcción", slug: "albanil"      },
  { label: "💡 Electricidad", slug: "electricista" },
  { label: "🎨 Pintura",      slug: "pintor"       },
  { label: "📚 Clases",       slug: "tutor"        },
  { label: "💅 Belleza",      slug: "belleza"      },
];

function isFilterActive(searchParams: {
  city?: string;
  skill?: string;
  income?: string;
  workStyle?: string;
}) {
  return Boolean(
    searchParams.city?.trim() ||
      searchParams.skill?.trim() ||
      searchParams.income?.trim() ||
      searchParams.workStyle?.trim()
  );
}

/** Extract unique cities from workers (ES5-safe, no Set spread). */
function extractCities(workers: Array<{ city?: string | null }>): string[] {
  const seen: Record<string, boolean> = {};
  const result: string[] = [];
  for (let i = 0; i < workers.length; i++) {
    const c = workers[i].city?.trim();
    if (c && !seen[c]) {
      seen[c] = true;
      result.push(c);
    }
  }
  return result.slice(0, 5);
}

export default async function Home({
  searchParams,
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
  const totalVerified = workersResult.verifiedWorkerCount;
  const filterActive = isFilterActive(searchParams);
  const showingFiltered = filterActive && workersResult.ok;

  // Social proof counter — round down to nearest 5 for "X+" feel
  const socialProofCount =
    totalVerified >= 5 ? Math.floor(totalVerified / 5) * 5 : totalVerified;

  // Live city signal — extracted from all workers (unfiltered would be ideal but
  // this gives a real, honest snapshot of who is currently active)
  const activeCities = extractCities(workers);

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
                El trabajador que necesitas está aquí.
              </h1>
              <p className="hero-copy">
                Trabajadores verificados en tu ciudad. Contáctalos directo por
                WhatsApp — sin agencias, sin comisiones.
              </p>

              {/* Hero stats — social proof */}
              {totalVerified > 0 && (
                <div className="hero-stats">
                  <div className="hero-stat">
                    <span className="hero-stat-number">
                      {socialProofCount > 0
                        ? `${socialProofCount}+`
                        : totalVerified}
                    </span>
                    <span className="hero-stat-label">verificados</span>
                  </div>
                  <div className="hero-stat-divider" aria-hidden="true" />
                  <div className="hero-stat">
                    <span className="hero-stat-number">1</span>
                    <span className="hero-stat-label">gratis / día</span>
                  </div>
                  <div className="hero-stat-divider" aria-hidden="true" />
                  <div className="hero-stat">
                    <span className="hero-stat-number">24h</span>
                    <span className="hero-stat-label">aprobación</span>
                  </div>
                </div>
              )}

              {/* Live city activity signal */}
              {activeCities.length > 0 && (
                <p className="hero-cities">
                  <span className="hero-cities-dot" aria-hidden="true" />
                  Activos en {activeCities.join(" · ")}
                </p>
              )}

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
            </div>

            <div className="trust-panel">
              <div className="hero-proof-card">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-hoja">
                    Disponibles hoy
                  </p>
                  <p className="mt-1 text-xl font-black leading-tight text-ink">
                    Limpieza · Plomería · Cocina · Construcción · Más
                  </p>
                </div>
                <span className="hero-proof-status">
                  <span className="hero-proof-dot" aria-hidden="true" />
                  En vivo
                </span>
              </div>
              <div className="hero-proof-list">
                <div>
                  <span>1</span>
                  Filtra por ciudad y servicio
                </div>
                <div>
                  <span>2</span>
                  Revisa perfiles verificados reales
                </div>
                <div>
                  <span>3</span>
                  Contacta directo por WhatsApp
                </div>
              </div>
              <div className="hero-proof-footer">
                <p>1 contacto gratis · sin registro</p>
                <Link href="/empleadores">Empezar →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── CATEGORY QUICK-FILTERS ── */}
        {/* Pills link to dedicated SEO category pages */}
        <section className="container category-section">
          <p className="mb-4 text-sm font-black uppercase tracking-wide text-hoja">
            ¿Qué necesitas?
          </p>
          <div className="category-pill-row">
            {CATEGORY_PILLS.map(({ label, slug }) => (
              <Link
                key={slug}
                href={`/categorias/${slug}`}
                className="category-pill"
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
            {/* Result count feedback when filters are active */}
            {showingFiltered && (
              <div className="results-count-tag">
                {hasWorkers ? (
                  <>
                    <span className="results-count-number">
                      {workers.length}
                    </span>{" "}
                    resultado{workers.length !== 1 ? "s" : ""}
                    {totalVerified > workers.length && (
                      <span className="results-count-total">
                        {" "}de {totalVerified}
                      </span>
                    )}
                  </>
                ) : (
                  "Sin resultados"
                )}
              </div>
            )}
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
                  {filterActive && hasWorkers
                    ? `${workers.length} trabajador${workers.length !== 1 ? "es" : ""} encontrado${workers.length !== 1 ? "s" : ""}`
                    : "Trabajadores disponibles ahora"}
                </h2>
                <p className="mt-1 text-sm font-bold text-ink/55">
                  {filterActive && hasWorkers
                    ? "Ordenados por relevancia · perfiles verificados"
                    : "Los más recientes primero · perfiles verificados"}
                </p>
              </div>
              {filterActive && hasWorkers && (
                <Link
                  href="/"
                  className="shrink-0 rounded-xl border border-[rgba(31,31,28,0.07)] bg-white px-3 py-2 text-sm font-black text-ink/60 shadow-soft hover:text-ink"
                >
                  Ver todos
                </Link>
              )}
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
                  Intenta de nuevo en unos minutos.
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
            ) : filterActive ? (
              /* ── No results for this filter ── */
              <div className="empty-state md:col-span-2 lg:col-span-3">
                <p className="text-4xl">🔍</p>
                <h3 className="mt-3 text-2xl font-black text-ink">
                  No encontramos trabajadores con ese filtro.
                </h3>
                <p className="mx-auto mt-2 max-w-xl leading-7 text-ink/70">
                  Prueba con una búsqueda más amplia o revisa todos los
                  trabajadores disponibles.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/"
                    className="btn-primary tap-target inline-flex items-center justify-center px-6 py-3 text-white"
                  >
                    Ver todos los trabajadores
                  </Link>
                  <Link
                    href="/trabajadores/registro"
                    className="btn-secondary tap-target inline-flex items-center justify-center px-6 py-3"
                  >
                    ¿Eres trabajador? Regístrate
                  </Link>
                </div>
              </div>
            ) : (
              /* ── Platform empty state ── */
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
              <h3 className="trust-item-title">Verificados manualmente</h3>
              <p className="trust-item-body">
                Cada perfil es revisado por nuestro equipo antes de publicarse.
                Nada automático, nada falso.
              </p>
            </div>
            <div className="trust-item">
              <span className="trust-item-icon">💬</span>
              <h3 className="trust-item-title">Directo a WhatsApp</h3>
              <p className="trust-item-body">
                Sin formularios, sin esperas. Hablas con la persona, no con un
                sistema. Un contacto gratis cada día.
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
                ¿Tienes un servicio que ofrecer?
              </h2>
              <p className="mt-2 leading-7 text-ink/70">
                Hazte visible hoy. Los clientes te encuentran y te escriben
                directo por WhatsApp — sin pagar comisiones.
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
