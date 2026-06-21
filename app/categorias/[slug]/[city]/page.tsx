import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { WorkerDiscovery } from "@/components/worker-discovery";
import { getCategoryBySlug, CATEGORIES } from "@/lib/categories";
import { getCityBySlug, CITIES } from "@/lib/cities";
import { getWorkersResult } from "@/lib/workers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  const params: { slug: string; city: string }[] = [];
  for (const cat of CATEGORIES) {
    for (const city of CITIES) {
      params.push({ slug: cat.slug, city: city.slug });
    }
  }
  return params;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { slug: string; city: string };
}): Promise<Metadata> {
  const cat = getCategoryBySlug(params.slug);
  const city = getCityBySlug(params.city);
  if (!cat || !city) return { title: "ListoRD" };

  const pluralCap = cat.plural.charAt(0).toUpperCase() + cat.plural.slice(1);
  const title = `${pluralCap} en ${city.name}, República Dominicana | ListoRD`;
  const desc = `Contrata ${cat.plural} verificados en ${city.name}. Perfiles verificados por nuestro equipo — escríbeles directo por WhatsApp. Sin agencias, sin comisiones.`;
  const url = `https://listordapp.com/categorias/${cat.slug}/${city.slug}`;

  return {
    title,
    description: desc,
    keywords: [
      cat.singular,
      cat.plural,
      city.name,
      city.region,
      "República Dominicana",
      "ListoRD",
      ...cat.keywords,
    ],
    alternates: { canonical: url },
    openGraph: { title, description: desc, url, type: "website" },
    twitter: { card: "summary", title, description: desc },
  };
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

function CityJsonLd({
  cat,
  city,
  workerCount,
}: {
  cat: ReturnType<typeof getCategoryBySlug>;
  city: ReturnType<typeof getCityBySlug>;
  workerCount: number;
}) {
  if (!cat || !city) return null;

  const url = `https://listordapp.com/categorias/${cat.slug}/${city.slug}`;
  const pluralCap = cat.plural.charAt(0).toUpperCase() + cat.plural.slice(1);

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${pluralCap} en ${city.name}`,
    description: `Encuentra ${cat.plural} verificados en ${city.name}, República Dominicana.`,
    provider: {
      "@type": "Organization",
      name: "ListoRD",
      url: "https://listordapp.com",
    },
    areaServed: {
      "@type": "City",
      name: city.name,
      containedInPlace: {
        "@type": "Country",
        name: "República Dominicana",
      },
    },
    url,
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
        item: `https://listordapp.com/categorias/${cat.slug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: city.name,
        item: url,
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

export default async function CityCategoryPage({
  params,
}: {
  params: { slug: string; city: string };
}) {
  const cat = getCategoryBySlug(params.slug);
  const city = getCityBySlug(params.city);
  if (!cat || !city) notFound();

  const workersResult = await getWorkersResult({ skill: cat.searchKey, city: city.name });
  const workers = workersResult.workers;
  const hasWorkers = workers.length > 0;
  const count = workers.length;
  const pluralCap = cat.plural.charAt(0).toUpperCase() + cat.plural.slice(1);

  return (
    <>
      <AppHeader />
      <CityJsonLd cat={cat} city={city} workerCount={count} />

      <main className="page-shell">

        {/* ── HERO ── */}
        <section className="cat-hero">
          <div className="container cat-hero-inner">

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="cat-breadcrumb">
              <Link href="/" className="cat-breadcrumb-link">
                ListoRD
              </Link>
              <span className="cat-breadcrumb-sep" aria-hidden="true">›</span>
              <Link href={`/categorias/${cat.slug}`} className="cat-breadcrumb-link">
                {cat.label}
              </Link>
              <span className="cat-breadcrumb-sep" aria-hidden="true">›</span>
              <span className="cat-breadcrumb-current">{city.name}</span>
            </nav>

            <p className="cat-kicker">
              <span className="cat-kicker-emoji">{cat.emoji}</span>
              {city.name}
            </p>
            <h1 className="cat-verb">
              {pluralCap} en<br />{city.name}.
            </h1>

            {/* Live count */}
            {hasWorkers && (
              <div className="cat-count-row">
                <span className="cat-count-dot" aria-hidden="true" />
                <span>
                  <strong>{count}</strong>{" "}
                  {count === 1 ? cat.singular : cat.plural} disponible
                  {count !== 1 ? "s" : ""} en {city.name}
                </span>
              </div>
            )}

            {/* Trust pills */}
            <div className="cat-trust-row">
              <span className="cat-trust-pill">✓ Verificados</span>
              <span className="cat-trust-pill">💬 Directo a WhatsApp</span>
              <span className="cat-trust-pill">📍 {city.name}</span>
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
              <Link href={`/categorias/${cat.slug}/${city.slug}`} className="btn-primary tap-target">
                Intentar de nuevo
              </Link>
            </div>
          ) : hasWorkers ? (
            <WorkerDiscovery workers={workers} categoryLabel={`${cat.label} en ${city.name}`} />
          ) : (
            <div className="empty-state">
              <p style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>{cat.emoji}</p>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)", marginBottom: "0.75rem" }}>
                Aún no hay {cat.plural} registrados en {city.name}.
              </h3>
              <p style={{ color: "rgba(26,61,43,0.65)", maxWidth: "460px", marginBottom: "1.5rem" }}>
                Mira todos los {cat.plural} disponibles en República Dominicana, o crea tu perfil gratis si ofreces este servicio en {city.name}.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
                <Link href={`/categorias/${cat.slug}`} className="btn-primary tap-target">
                  Ver todos en RD
                </Link>
                <Link href="/trabajadores/registro" className="btn-primary tap-target">
                  Crear mi perfil
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* ── WORKER CTA ── */}
        <section className="container worker-cta-banner">
          <div className="worker-cta-inner">
            <div>
              <h2>¿Eres {cat.singular} en {city.name}?</h2>
              <p>
                Hazte visible en ListoRD. Los clientes de {city.name} te encuentran y te escriben directo por WhatsApp — sin pagar comisiones.
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

        {/* ── OTRAS CIUDADES ── */}
        <section className="container cat-more-section">
          <p className="section-eyebrow">{pluralCap} en otras ciudades</p>
          <div className="category-pill-row" style={{ marginTop: "0.75rem" }}>
            {CITIES.filter((c) => c.slug !== city.slug).map((c) => (
              <Link key={c.slug} href={`/categorias/${cat.slug}/${c.slug}`} className="category-pill">
                📍 {c.name}
              </Link>
            ))}
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <Link href={`/categorias/${cat.slug}`} className="category-pill">
              ← Todos los {cat.plural} en RD
            </Link>
          </div>
        </section>

      </main>
    </>
  );
}
