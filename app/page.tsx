import { AppHeader } from "@/components/app-header";
import { FilterBar } from "@/components/filter-bar";
import { WorkerDiscovery } from "@/components/worker-discovery";
import { getWorkersResult } from "@/lib/workers";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "¡Encontramos a tu próximo trabajador!",
  description: "Explora trabajadores gratis en República Dominicana y conecta directamente con el perfil que necesitas por RD$100, o publica tu vacante.",
  openGraph: {
    title: "¡Encontramos a tu próximo trabajador! | ListoRD",
    description: "Explora trabajadores gratis y conecta directamente por RD$100, o publica tu vacante.",
  },
};

const CATEGORY_ITEMS = [
  { emoji: "🧹", label: "Limpieza",      slug: "limpiadora"   },
  { emoji: "🍳", label: "Cocina",        slug: "cocinera"     },
  { emoji: "🔧", label: "Plomería",      slug: "plomero"      },
  { emoji: "⚡", label: "Electricidad",  slug: "electricista" },
  { emoji: "🏗️", label: "Construcción",  slug: "albanil"      },
  { emoji: "🎨", label: "Pintura",       slug: "pintor"       },
  { emoji: "📚", label: "Clases",        slug: "tutor"        },
  { emoji: "💅", label: "Belleza",       slug: "belleza"      },
  { emoji: "🌿", label: "Jardinería",    slug: "jardinero"    },
  { emoji: "🚗", label: "Conductor",     slug: "chofer"       },
  { emoji: "👶", label: "Cuidado niños", slug: "ninera"       },
  { emoji: "🏥", label: "Cuidado adultos", slug: "cuidadora"  },
  { emoji: "🔨", label: "Carpintería",   slug: "carpintero"   },
  { emoji: "🔒", label: "Seguridad",     slug: "vigilante"    },
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

export default async function Home({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{
    city?: string;
    skill?: string;
    income?: string;
    workStyle?: string;
  }>;
}) {
  const searchParams = await searchParamsPromise;
  const workersResult = await getWorkersResult(searchParams);
  const workers = workersResult.workers;
  const hasWorkers = workers.length > 0;
  const totalVerified = workersResult.verifiedWorkerCount;
  const filterActive = isFilterActive(searchParams);
  const showingFiltered = filterActive && workersResult.ok;

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
            <div className="hero-layout">
              <div className="hero-inner">

              <p className="hero-eyebrow">
                🇩🇴 HECHO PARA REPÚBLICA DOMINICANA
              </p>

              <h1 className="hero-title text-balance">
                ¡ENCONTRAMOS A TU PRÓXIMO TRABAJADOR!
              </h1>

              <p className="mb-5 text-xl font-bold leading-snug text-[var(--ink)] sm:text-2xl">
                El personal que necesitas. Sin tantas vueltas.
              </p>

              <div className="hero-actions">
                <Link href="#descubre" className="btn-primary tap-target min-h-12 w-full text-center whitespace-normal sm:w-auto">
                  ENCUENTRA TU TRABAJADOR
                </Link>
                <Link href="/solicitar#publicar-vacante" className="btn-secondary tap-target min-h-12 w-full text-center whitespace-normal sm:w-auto">
                  PUBLICA Y ESPERA
                </Link>
              </div>

              <div className="hero-body mb-5 mt-6 space-y-3">
                <p>¿Necesitas personal para tu negocio o tu hogar? Explora trabajadores disponibles y conecta directamente con el perfil que necesitas por solo RD$100.</p>
                <p>¿Prefieres esperar? Publica tu vacante y recibe candidatos interesados.</p>
              </div>

              <p className="hero-stats">
                {workersResult.ok && (
                  <>
                    <span className="hero-stat-num">{totalVerified}</span>
                    <span>trabajadores</span>
                    <span className="hero-stat-sep">·</span>
                  </>
                )}
                <span>Explora gratis</span>
                <span className="hero-stat-sep">·</span>
                <span>Conexión directa RD$100</span>
              </p>

              </div>
              <aside className="hero-brand-statement" aria-label="La visión de ListoRD">
                <span className="hero-brand-statement__rule" aria-hidden="true" />
                <p className="hero-brand-statement__label">Nuestra razón de ser</p>
                <p className="hero-brand-statement__quote">Encuentra. Conecta. Contrata.</p>
                <p className="hero-brand-statement__signature">ListoRD</p>
              </aside>
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
              {showingFiltered ? "Resultados" : "Perfiles de trabajadores"}
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
                Estamos agregando perfiles de trabajadores revisados en RD.
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
              <h3 className="trust-item-title">Perfiles revisados</h3>
              <p className="trust-item-body">
                Cada perfil se revisa antes de publicarse. Confirma identidad, experiencia y disponibilidad directamente.
              </p>
            </div>
            <div className="trust-item">
              <span className="trust-item-icon">💬</span>
              <h3 className="trust-item-title">Directo a WhatsApp</h3>
              <p className="trust-item-body">
                Revisa perfiles gratis. Cuando elijas a alguien, conecta por WhatsApp desde RD$100 o usa un crédito que ya tengas.
              </p>
            </div>
            <div className="trust-item">
              <span className="trust-item-icon">🇩🇴</span>
              <h3 className="trust-item-title">Hecho para RD</h3>
              <p className="trust-item-body">
                Diseñado para el mercado dominicano. Revisa perfiles en tu ciudad y confirma su disponibilidad.
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
