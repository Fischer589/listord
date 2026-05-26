import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { WorkerDiscovery } from "@/components/worker-discovery";
import { getCategoryBySlug, CATEGORIES } from "@/lib/categories";
import { getWorkersResult } from "@/lib/workers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Pre-declare all known slugs for static analysis
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

  return (
    <>
      <AppHeader />
      <CategoryJsonLd cat={cat} workerCount={count} />

      <main className="page-shell">

        {/* ── CATEGORY HERO ── */}
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

            {/* Kicker + Title */}
            <p className="cat-kicker">
              <span className="cat-kicker-emoji">{cat.emoji}</span>
              {cat.label}
            </p>
            <h1 className="cat-title">{cat.heroTitle}</h1>
            <p className="cat-desc">{cat.heroDesc}</p>

            {/* Live count */}
            {hasWorkers && (
              <div className="cat-count-row">
                <span className="cat-count-dot" aria-hidden="true" />
                <span className="cat-count-text">
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

        {/* ── IMMERSIVE WORKER DISCOVERY ── */}
        <section className="container cat-discovery-section">
          {!workersResult.ok ? (
            <div className="empty-state">
              <p className="text-sm font-black uppercase tracking-wide text-hoja">
                Error de conexión
              </p>
              <h3 className="mt-2 text-xl font-black text-ink">
                No pudimos cargar los perfiles ahora mismo.
              </h3>
              <p className="mt-2 leading-7 text-ink/65">
                Intenta de nuevo en unos minutos.
              </p>
              <Link
                href={`/categorias/${cat.slug}`}
                className="btn-primary tap-target mt-5 inline-flex items-center justify-center px-6 py-3 text-white"
              >
                Intentar de nuevo
              </Link>
            </div>
          ) : hasWorkers ? (
            <WorkerDiscovery workers={workers} categoryLabel={cat.label} />
          ) : (
            /* Empty — still a useful SEO page + CTA for workers */
            <div className="empty-state">
              <p className="text-3xl">{cat.emoji}</p>
              <h3 className="mt-3 text-xl font-black text-ink">
                Aún no hay {cat.plural} registradas.
              </h3>
              <p className="mx-auto mt-2 max-w-xl leading-7 text-ink/65">
                ¿Ofreces este servicio? Crea tu perfil gratis y sé el primero
                en aparecer cuando los clientes busquen {cat.singular} en RD.
              </p>
              <Link
                href="/trabajadores/registro"
                className="btn-primary tap-target mt-5 inline-flex items-center justify-center px-6 py-3 text-white"
              >
                Crear mi perfil gratis
              </Link>
            </div>
          )}
        </section>

        {/* ── WORKER REGISTRATION CTA ── */}
        <section className="container worker-cta-banner">
          <div className="worker-cta-inner">
            <div>
              <h2 className="text-xl font-black text-ink">
                ¿Eres {cat.singular}?
              </h2>
              <p className="mt-1.5 leading-7 text-ink/65">
                Hazte visible en ListoRD. Los clientes te encuentran y te
                escriben directo por WhatsApp — sin pagar comisiones.
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

        {/* ── OTHER CATEGORIES ── */}
        <section className="container cat-more-section">
          <p className="mb-4 text-sm font-black uppercase tracking-wide text-hoja">
            Otras categorías
          </p>
          <div className="category-pill-row">
            {CATEGORIES.filter((c) => c.slug !== cat.slug).map((c) => (
              <Link
                key={c.slug}
                href={`/categorias/${c.slug}`}
                className="category-pill"
              >
                {c.emoji} {c.label}
              </Link>
            ))}
          </div>
        </section>

      </main>
    </>
  );
}
