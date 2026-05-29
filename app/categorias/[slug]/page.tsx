import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { WorkerDiscovery } from "@/components/worker-discovery";
import { getCategoryBySlug, CATEGORIES } from "@/lib/categories";
import { getWorkersResult } from "@/lib/workers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Action-form verbs for each category slug
const CATEGORY_VERBS: Record<string, string> = {
  limpiadora:  "Limpias.",
  cocinera:    "Cocinas.",
  plomero:     "Arreglas.",
  electricista:"Instalas.",
  albanil:     "Construyes.",
  pintor:      "Pintas.",
  tutor:       "Enseñas.",
  belleza:     "Embelleces.",
};

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const cat = getCategoryBySlug(params.slug);
  if (!cat) return { title: "Categoría | ListoRD" };

  return {
    title: cat.seoTitle,
    description: cat.seoDesc,
    keywords: cat.keywords,
    alternates: {
      canonical: `https://listordapp.com/categorias/${cat.slug}`,
    },
    openGraph: {
      title: cat.seoTitle,
      description: cat.seoDesc,
      url: `https://listordapp.com/categorias/${cat.slug}`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: cat.seoTitle,
      description: cat.seoDesc,
    },
  };
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

function CategoryJsonLd({
  cat,
  workerCount,
}: {
  cat: ReturnType<typeof getCategoryBySlug>;
  workerCount: number;
}) {
  if (!cat) return null;

  const profileUrl = `https://listordapp.com/categorias/${cat.slug}`;

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: cat.heroTitle,
    description: cat.seoDesc,
    provider: {
      "@type": "Organization",
      name: "ListoRD",
      url: "https://listordapp.com",
    },
    areaServed: {
      "@type": "Country",
      name: "República Dominicana",
    },
    url: profileUrl,
    ...(workerCount > 0 ? { numberOfItems: workerCount } : {}),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "ListoRD",
        item: "https://listordapp.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: cat.label,
        item: profileUrl,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const cat = getCategoryBySlug(params.slug);
  if (!cat) notFound();

  const workersResult = await getWorkersResult({ skill: cat.searchKey });
  const workers = workersResult.workers;
  const hasWorkers = workers.length > 0;
  const count = workers.length;

  const verb = CATEGORY_VERBS[cat.slug] ?? `${cat.label}.`;

  return (
    <>
      <AppHeader />
      <CategoryJsonLd cat={cat} workerCount={count} />

      <main className="page-shell">

        {/* ── CATEGORY HERO — "Verb. Te buscan." ── */}
        <section className="cat-hero">
          <div className="container cat-hero-inner">

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="cat-breadcrumb">
              <Link href="/" className="cat-breadcrumb-link">
                ListoRD
              </Link>
              <span className="cat-breadcrumb-sep" aria-hidden="true">›</span>
              <span className="cat-breadcrumb-current">{cat.label}</span>
            </nav>

            {/* The "ad" pattern */}
            <p className="cat-kicker">
              <span className="cat-kicker-emoji">{cat.emoji}</span>
              {cat.label}
            </p>
            <h1 className="cat-verb">{verb}</h1>
            <h2 className="cat-verb" style={{ color: "var(--green)", marginTop: "0", marginBottom: "1.5rem" }}>
              Te buscan.
            </h2>
            <p className="cat-desc">{cat.heroDesc}</p>

            {/* Live count */}
            {hasWorkers && (
              <div className="cat-count-row">
                <span className="cat-count-dot" aria-hidden="true" />
                <span>
                  <strong>{count}</strong>{" "}
                  {count === 1 ? cat.singular : cat.plural} disponible
                  {count !== 1 ? "s" : ""} ahora
                </span>
              </div>
            )}

            {/* Trust pills */}
            <div className="cat-trust-row">
              <span className="cat-trust-pill">✓ Verificados</span>
              <span className="cat-trust-pill">💬 Directo a WhatsApp</span>
              <span className="cat-trust-pill">🇩🇴 Solo en RD</span>
            </div>

          </div>
        </section>

        {/* ── WORKER DISCOVERY ── */}
        <section className="container cat-discovery-section">
          {!workersResult.ok ? (
            <div className="empty-state">
              <p className="section-eyebrow">Error de conexión</p>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)", margin: "0.75rem 0" }}>
                No pudimos cargar los perfiles ahora mismo.
              </h3>
              <p style={{ color: "rgba(26,61,43,0.65)", marginBottom: "1.5rem" }}>
                Intenta de nuevo en unos minutos.
              </p>
              <Link href={`/categorias/${cat.slug}`} className="btn-primary tap-target">
                Intentar de nuevo
              </Link>
            </div>
          ) : hasWorkers ? (
            <WorkerDiscovery workers={workers} categoryLabel={cat.label} />
          ) : (
            <div className="empty-state">
              <p style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>{cat.emoji}</p>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)", marginBottom: "0.75rem" }}>
                Aún no hay {cat.plural} registradas.
              </h3>
              <p style={{ color: "rgba(26,61,43,0.65)", maxWidth: "460px", marginBottom: "1.5rem" }}>
                ¿Ofreces este servicio? Crea tu perfil gratis y sé el primero en aparecer cuando los clientes busquen {cat.singular} en RD.
              </p>
              <Link href="/trabajadores/registro" className="btn-primary tap-target">
                Crear mi perfil gratis
              </Link>
            </div>
          )}
        </section>

        {/* ── WORKER REGISTRATION CTA ── */}
        <section className="container worker-cta-banner">
          <div className="worker-cta-inner">
            <div>
              <h2>¿Eres {cat.singular}?</h2>
              <p>
                Hazte visible en ListoRD. Los clientes te encuentran y te escriben directo por WhatsApp — sin pagar comisiones.
              </p>
            </div>
            <Link
              href="/trabajadores/registro"
              className="btn-primary tap-target"
            >
              Crear mi perfil gratis
            </Link>
          </div>
        </section>

        {/* ── OTHER CATEGORIES ── */}
        <section className="container cat-more-section">
          <p className="section-eyebrow">Otras categorías</p>
          <div className="category-pill-row" style={{ marginTop: "0.75rem" }}>
            {CATEGORIES.filter((c) => c.slug !== cat.slug).map((c) => (
              <Link key={c.slug} href={`/categorias/${c.slug}`} className="category-pill">
                {c.emoji} {c.label}
              </Link>
            ))}
          </div>
        </section>

      </main>
    </>
  );
}
