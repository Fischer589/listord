import { AppHeader } from "@/components/app-header";
import { FilterBar } from "@/components/filter-bar";
import { WorkerDiscovery } from "@/components/worker-discovery";
import { getWorkersResult } from "@/lib/workers";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  const socialProofCount =
    totalVerified >= 5 ? Math.floor(totalVerified / 5) * 5 : totalVerified;
  const activeCities = extractCities(workers);
  const filterLabel =
    searchParams.skill?.trim() || searchParams.city?.trim() || undefined;

  return (
    <>
      <AppHeader />
      <main className="page-shell">

        {/* ══════════════════════════════════════════
            1. HERO
        ══════════════════════════════════════════ */}
        <section className="hero">
          <div className="container">
            <div className="hero-inner">

              <p className="hero-eyebrow">
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--green)", marginRight: "0.5rem", opacity: 0.85 }} />
                Solo en República Dominicana 🇩🇴
              </p>

              <h1 className="hero-title">
                Trabajas.<br />
                Te buscan.
              </h1>

              <p className="hero-body">
                Perfiles verificados. Contacto directo por WhatsApp.<br />
                Sin agencias, sin comisiones.
              </p>

              {totalVerified > 0 && (
                <p className="hero-stats">
                  <span className="hero-stat-num">
                    {socialProofCount > 0 ? `${socialProofCount}+` : totalVerified}
                  </span>
                  <span className="hero-stat-sep">trabajadores</span>
                  <span className="hero-stat-sep">·</span>
                  <span>1 contacto gratis</span>
                  {activeCities.length > 0 && (
                    <>
                      <span className="hero-stat-sep">·</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <span className="hero-cities-dot" aria-hidden="true" />
                        {activeCities[0]}{activeCities.length > 1 ? ` · ${activeCities[1]}` : ""}
                      </span>
                    </>
                  )}
                </p>
              )}

              <div className="hero-actions">
                <a href="#descubre" className="btn-primary tap-target">
                  Ver trabajadores
                </a>
                <Link href="/trabajadores/registro" className="btn-secondary tap-target">
                  Busco trabajo
                </Link>
              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            2. DISCOVERY CONTROLS
            Categories + Filter — starts the marketplace
        ══════════════════════════════════════════ */}
        <section className="container" style={{ paddingTop: "1.75rem", paddingBottom: "0.25rem" }}>

          {/* Category shortcuts */}
          <div className="cat-pills" style={{ paddingTop: 0, paddingBottom: "1.25rem" }}>
            {CATEGORY_ITEMS.map(({ emoji, label, slug }) => (
              <Link key={slug} href={`/categorias/${slug}`} className="cat-pill">
                <span aria-hidden="true">{emoji}</span>
                {label}
              </Link>
            ))}
          </div>

          {/* Filter bar — immediately below categories */}
          <div style={{
            padding: "1.25rem 1.375rem",
            borderRadius: "var(--r-xl)",
            background: "var(--surface-pure)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-xs)",
          }}>
            <p className="section-eyebrow" style={{ marginBottom: "0.875rem" }}>
              Busca por oficio, ciudad o modalidad
            </p>
            <FilterBar
              city={searchParams.city}
              skill={searchParams.skill}
              income={searchParams.income}
              workStyle={searchParams.workStyle}
            />
          </div>

        </section>

        {/* ══════════════════════════════════════════
            3. WORKER RESULTS
        ══════════════════════════════════════════ */}
        <section id="descubre" className="container discovery-section" style={{ paddingTop: "2.5rem" }}>

          <div className="section-header">
            <p className="section-eyebrow">
              {showingFiltered ? "Resultados" : "Disponibles ahora"}
            </p>
            {filterActive && hasWorkers && (
              <p className="section-title">
                {workers.length} trabajador{workers.length !== 1 ? "es" : ""} encontrado{workers.length !== 1 ? "s" : ""}
              </p>
            )}
            {showingFiltered && hasWorkers && (
              <Link href="/" className="btn-ghost" style={{ marginTop: "0.5rem", display: "inline-flex" }}>
                Ver todos →
              </Link>
            )}
          </div>

          {/* Error state */}
          {!workersResult.ok && (
            <div className="empty-state">
              <p className="section-eyebrow">Conexión interrumpida</p>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)", margin: "0.75rem 0" }}>
                No pudimos cargar los trabajadores.
              </h3>
              <p style={{ color: "rgba(26,61,43,0.65)", marginBottom: "1.5rem" }}>
                Intenta de nuevo en unos minutos.
              </p>
              <Link href="/" className="btn-primary tap-target">Intentar de nuevo</Link>
            </div>
          )}

          {/* Filter active — no results */}
          {workersResult.ok && filterActive && !hasWorkers && (
            <div className="empty-state">
              <p style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔍</p>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)", marginBottom: "0.75rem" }}>
                No encontramos resultados con ese filtro.
              </h3>
              <p style={{ color: "rgba(26,61,43,0.65)", marginBottom: "1.5rem" }}>
                Prueba con una búsqueda más amplia.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
                <Link href="/" className="btn-primary tap-target">Ver todos los trabajadores</Link>
                <Link href="/trabajadores/registro" className="btn-secondary tap-target">¿Eres trabajador? Regístrate</Link>
              </div>
            </div>
          )}

          {/* No workers at all */}
          {workersResult.ok && !filterActive && !hasWorkers && (
            <div className="empty-state">
              <p style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🇩🇴</p>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)", marginBottom: "0.75rem" }}>
                Estamos agregando trabajadores verificados en RD.
              </h3>
              <p style={{ color: "rgba(26,61,43,0.65)", marginBottom: "1.5rem" }}>
                ¿Ofreces un servicio? Crea tu perfil gratis hoy.
              </p>
              <Link href="/trabajadores/registro" className="btn-primary tap-target">
                Crear mi perfil gratis
              </Link>
            </div>
          )}

          {/* The carousel */}
          {workersResult.ok && hasWorkers && (
            <WorkerDiscovery workers={workers} categoryLabel={filterLabel} />
          )}

        </section>

        {/* ══════════════════════════════════════════
            4. TRUST + CTA (below the fold)
        ══════════════════════════════════════════ */}
        <section className="container trust-section">
          <p className="trust-eyebrow">¿Por qué ListoRD?</p>
          <div className="trust-section-grid">
            <div className="trust-item">
              <span className="trust-item-icon">✓</span>
              <h3 className="trust-item-title">Verificados manualmente</h3>
              <p className="trust-item-body">
                Cada perfil es revisado por nuestro equipo antes de publicarse. Nada automático, nada falso.
              </p>
            </div>
            <div className="trust-item">
              <span className="trust-item-icon">💬</span>
              <h3 className="trust-item-title">Directo a WhatsApp</h3>
              <p className="trust-item-body">
                Sin formularios, sin esperas. Hablas con la persona — no con un sistema. Un contacto gratis cada día.
              </p>
            </div>
            <div className="trust-item">
              <span className="trust-item-icon">🇩🇴</span>
              <h3 className="trust-item-title">Hecho para RD</h3>
              <p className="trust-item-body">
                Diseñado para el mercado dominicano. Trabajadores reales, en tu ciudad, disponibles hoy.
              </p>
            </div>
          </div>
        </section>

        <section className="container worker-cta-banner">
          <div className="worker-cta-inner">
            <div>
              <h2>¿Tienes un servicio que ofrecer?</h2>
              <p>
                Hazte visible. Los clientes te encuentran y te escriben directo por WhatsApp — sin comisiones.
              </p>
            </div>
            <Link href="/trabajadores/registro" className="btn-primary tap-target">
              Crear mi perfil gratis →
            </Link>
          </div>
        </section>

      </main>
    </>
  );
}
