import { AppHeader } from "@/components/app-header";
import { FilterBar } from "@/components/filter-bar";
import { WorkerDiscovery } from "@/components/worker-discovery";
import { getWorkersResult } from "@/lib/workers";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Each card maps directly to a /categorias/[slug] SEO page
const CATEGORY_ITEMS = [
  { emoji: "🧹", label: "Limpieza",      slug: "limpiadora"   },
  { emoji: "🍳", label: "Cocina",        slug: "cocinera"     },
  { emoji: "🔧", label: "Plomería",      slug: "plomero"      },
  { emoji: "⚡", label: "Electricidad",  slug: "electricista" },
  { emoji: "🏗️", label: "Construcción",  slug: "albanil"      },
  { emoji: "🎨", label: "Pintura",       slug: "pintor"       },
  { emoji: "📚", label: "Clases",        slug: "tutor"        },
  { emoji: "💅", label: "Belleza",       slug: "belleza"      },
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

  // Live city signal — real snapshot of active workers
  const activeCities = extractCities(workers);

  // Label for carousel aria / heading when filter is active
  const filterLabel =
    searchParams.skill?.trim() || searchParams.city?.trim() || undefined;

  return (
    <>
      <AppHeader />
      <main className="page-shell">

        {/* ── HERO — editorial, confident, no over-explanation ── */}
        <section className="hero-section">
          <div className="container hero-inner">

            <p className="hero-eyebrow">
              Solo en República Dominicana 🇩🇴
            </p>

            <h1 className="hero-title">
              Trabajas.<br />Te buscan.
            </h1>

            <p className="hero-subline">
              Perfiles verificados en RD. Contacta directo por WhatsApp — sin agencias, sin comisiones.
            </p>

            {/* Inline stats — no boxes, just typography */}
            {totalVerified > 0 && (
              <div className="hero-stats">
                <span className="hero-stat-num">
                  {socialProofCount > 0 ? `${socialProofCount}+` : totalVerified}
                </span>
                <span className="hero-stat-sep">trabajadores</span>
                <span className="hero-stat-sep">·</span>
                <span>1 contacto gratis</span>
                <span className="hero-stat-sep">·</span>
                <span>aprobación 24h</span>
                {activeCities.length > 0 && (
                  <>
                    <span className="hero-stat-sep">·</span>
                    <span className="flex items-center gap-1">
                      <span className="hero-cities-dot" aria-hidden="true" />
                      {activeCities[0]}{activeCities.length > 1 ? ` · ${activeCities[1]}` : ""}
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="hero-actions">
              <a
                href="#descubre"
                className="btn-primary tap-target inline-flex min-w-0 items-center justify-center px-7 py-4 text-base text-white"
              >
                Descubrir trabajadores
              </a>
              <Link
                href="/trabajadores/registro"
                className="btn-secondary tap-target inline-flex min-w-0 items-center justify-center px-7 py-4 text-base"
              >
                Crear mi perfil
              </Link>
            </div>

          </div>
        </section>

        {/* ── CATEGORY GRID ── */}
        <section className="container category-section">
          <p className="category-eyebrow">
            ¿Qué necesitas?
          </p>
          <div className="category-grid">
            {CATEGORY_ITEMS.map(({ emoji, label, slug }) => (
              <Link
                key={slug}
                href={`/categorias/${slug}`}
                className="category-card"
              >
                <span className="category-card-emoji" aria-hidden="true">
                  {emoji}
                </span>
                <span className="category-card-label">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── NETWORK PULSE — minimal activity signal ── */}
        {totalVerified > 0 && (
          <section className="container network-pulse-section">
            <div className="network-pulse-bar">
              <div className="network-pulse-item network-pulse-item--inline">
                <span className="network-pulse-dot" aria-hidden="true" />
                <span className="network-pulse-label">Activos ahora</span>
              </div>
              <div className="network-pulse-divider" aria-hidden="true" />
              <div className="network-pulse-item">
                <span className="network-pulse-number">
                  {socialProofCount > 0 ? `${socialProofCount}+` : totalVerified}
                </span>
                <span className="network-pulse-label">perfiles</span>
              </div>
              {activeCities.length > 0 && (
                <>
                  <div className="network-pulse-divider" aria-hidden="true" />
                  <div className="network-pulse-item">
                    <span className="network-pulse-number">
                      {activeCities.length}+
                    </span>
                    <span className="network-pulse-label">ciudades</span>
                  </div>
                </>
              )}
              <div className="network-pulse-divider" aria-hidden="true" />
              <div className="network-pulse-item">
                <span className="network-pulse-number">8</span>
                <span className="network-pulse-label">categorías</span>
              </div>
              <div className="network-pulse-divider" aria-hidden="true" />
              <div className="network-pulse-item">
                <span className="network-pulse-number">1</span>
                <span className="network-pulse-label">gratis / día</span>
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════
            DISCOVERY CAROUSEL — primary browsing surface
        ══════════════════════════════════════════════ */}
        <section id="descubre" className="container discovery-section">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-hoja">
                {showingFiltered ? "Resultados" : "Explora perfiles"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-ink">
                {filterActive && hasWorkers
                  ? `${workers.length} trabajador${workers.length !== 1 ? "es" : ""} encontrado${workers.length !== 1 ? "s" : ""}`
                  : "Trabajadores disponibles ahora"}
              </h2>
              {filterActive && hasWorkers && (
                <p className="mt-1 text-sm font-bold text-ink/55">
                  Ordenados por relevancia · perfiles verificados
                </p>
              )}
            </div>
            {showingFiltered && hasWorkers && (
              <Link
                href="/"
                className="shrink-0 rounded-full border border-[rgba(26,26,23,0.07)] bg-white px-3 py-2 text-sm font-black text-ink/60 shadow-soft hover:text-ink"
              >
                Ver todos
              </Link>
            )}
          </div>

          {/* Error state */}
          {!workersResult.ok && (
            <div className="empty-state">
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
          )}

          {/* Filter active — no results */}
          {workersResult.ok && filterActive && !hasWorkers && (
            <div className="empty-state">
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
          )}

          {/* No workers at all (empty DB) */}
          {workersResult.ok && !filterActive && !hasWorkers && (
            <div className="empty-state">
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

          {/* ── THE CAROUSEL — only rendered when there are workers ── */}
          {workersResult.ok && hasWorkers && (
            <WorkerDiscovery
              workers={workers}
              categoryLabel={filterLabel}
            />
          )}
        </section>

        {/* ── FILTER BAR — deeper exploration ── */}
        <section className="container filter-section">
          <div className="mb-5 flex flex-col gap-1">
            <p className="text-sm font-black uppercase tracking-wide text-hoja">
              Búsqueda avanzada
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">
              Filtra por ciudad, oficio o disponibilidad
            </h2>
          </div>
          <FilterBar
            city={searchParams.city}
            skill={searchParams.skill}
            income={searchParams.income}
            workStyle={searchParams.workStyle}
          />
        </section>

        {/* ── TRUST SECTION ── */}
        <section className="container trust-section">
          <p className="trust-eyebrow">
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
              <h2>
                ¿Tienes un servicio que ofrecer?
              </h2>
              <p>
                Hazte visible hoy. Los clientes te encuentran y te escriben
                directo por WhatsApp — sin comisiones.
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
