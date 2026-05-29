import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { WorkerProfileContactButton } from "@/components/worker-profile-contact-button";
import { ShareProfileButton } from "@/components/share-profile-button";
import { getSupabaseClient } from "@/lib/supabase";
import { formatIncomeShort, workStyleLabels } from "@/lib/format";
import type { Worker, WorkStyle } from "@/lib/types";

export const dynamic = "force-dynamic";

const PROFILE_SELECT = `
  id,
  full_name,
  city,
  work_style,
  desired_income,
  short_intro,
  skills,
  photo_url,
  created_at
`;

type ProfileRow = Pick<
  Worker,
  | "id"
  | "full_name"
  | "city"
  | "work_style"
  | "desired_income"
  | "short_intro"
  | "skills"
  | "photo_url"
  | "created_at"
>;

async function getWorkerProfile(slug: string): Promise<ProfileRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("workers")
    .select(PROFILE_SELECT)
    .eq("id", slug)
    .eq("is_verified", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProfileRow;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "LR"
  );
}

function getSkills(worker: ProfileRow) {
  return Array.isArray(worker.skills)
    ? worker.skills.map((s) => s.trim()).filter(Boolean)
    : [];
}

function formatMemberSince(createdAt: string | undefined): string | null {
  if (!createdAt) return null;
  try {
    return new Date(createdAt).toLocaleDateString("es-DO", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function isNewProfile(createdAt: string | undefined, days = 30): boolean {
  if (!createdAt) return false;
  try {
    return (
      Date.now() - new Date(createdAt).getTime() < days * 24 * 60 * 60 * 1000
    );
  } catch {
    return false;
  }
}

// ─── SEO Metadata ─────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const worker = await getWorkerProfile(params.slug);
  if (!worker) return { title: "Perfil no encontrado | ListoRD" };

  const name = worker.full_name || "Trabajador ListoRD";
  const skills = getSkills(worker);
  const primarySkill = skills[0] || "Trabajador disponible";
  const city = worker.city || "República Dominicana";
  const description =
    worker.short_intro ||
    `${name} es ${primarySkill} en ${city}. Perfil verificado en ListoRD. Contáctalo directo por WhatsApp — sin intermediarios.`;

  return {
    title: `${name} — ${primarySkill} en ${city}`,
    description,
    keywords: [
      name,
      primarySkill,
      city,
      ...skills.slice(0, 3),
      "trabajador verificado",
      "República Dominicana",
      "ListoRD",
    ].filter(Boolean),
    openGraph: {
      title: `${name} — ${primarySkill} en ${city} | ListoRD`,
      description,
      url: `https://listordapp.com/trabajador/${worker.id}`,
      type: "profile",
      ...(worker.photo_url
        ? { images: [{ url: worker.photo_url, alt: `Foto de ${name}` }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — ${primarySkill} en ${city}`,
      description,
      ...(worker.photo_url ? { images: [worker.photo_url] } : {}),
    },
  };
}

// ─── JSON-LD structured data ──────────────────────────────────────────────────

function WorkerJsonLd({
  worker,
  skills,
  profileUrl,
}: {
  worker: ProfileRow;
  skills: string[];
  profileUrl: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: worker.full_name || "Trabajador ListoRD",
    jobTitle: skills[0] || "Trabajador",
    ...(worker.short_intro ? { description: worker.short_intro } : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: worker.city || "República Dominicana",
      addressCountry: "DO",
    },
    url: profileUrl,
    ...(worker.photo_url ? { image: worker.photo_url } : {}),
    worksFor: {
      "@type": "Organization",
      name: "ListoRD",
      url: "https://listordapp.com",
    },
    ...(skills.length > 0
      ? {
          hasOccupation: {
            "@type": "Occupation",
            name: skills[0],
            skills: skills.join(", "),
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { step: "1", text: `Haz clic en "Contactar por WhatsApp" abajo` },
  { step: "2", text: "Se abre WhatsApp con un mensaje listo para enviar" },
  { step: "3", text: "Hablas directamente con la persona — sin intermediarios" },
];

export default async function WorkerProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const worker = await getWorkerProfile(params.slug);
  if (!worker) notFound();

  const fullName = worker.full_name || "Trabajador ListoRD";
  const city = worker.city || "República Dominicana";
  const skills = getSkills(worker);
  const primarySkill = skills[0] || "Trabajador disponible";
  const supportingSkills = skills.slice(1);
  const workStyle =
    worker.work_style && worker.work_style in workStyleLabels
      ? (worker.work_style as WorkStyle)
      : null;
  const profileUrl = `https://listordapp.com/trabajador/${worker.id}`;
  const memberSince = formatMemberSince(worker.created_at);
  const isNew = isNewProfile(worker.created_at, 30);

  return (
    <>
      <AppHeader />
      <WorkerJsonLd worker={worker} skills={skills} profileUrl={profileUrl} />

      <main className="page-shell">

        {/* ── PROFILE HERO — photo + identity ── */}
        <section style={{ background: "var(--cream)", paddingTop: "clamp(2rem,5vw,4rem)", paddingBottom: "0" }}>
          <div className="container">
            <Link
              href="/"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.82rem", fontWeight: 700, color: "rgba(26,61,43,0.55)", marginBottom: "2rem" }}
              className="hover:text-[var(--ink)] transition-colors"
            >
              ← Volver al inicio
            </Link>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }} className="md:grid-cols-[380px_1fr]">

              {/* LEFT: Photo + share */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                {/* Photo card */}
                <div
                  style={{
                    overflow: "hidden",
                    borderRadius: "var(--r-2xl)",
                    border: "1px solid var(--border)",
                    background: "var(--surface-pure)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div className="profile-photo-wrap">
                    {worker.photo_url ? (
                      <Image
                        src={worker.photo_url}
                        alt={`Foto de ${fullName}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 380px"
                        className="object-cover object-center"
                        priority
                      />
                    ) : (
                      <div className="profile-photo-fallback">
                        {getInitials(fullName)}
                      </div>
                    )}
                    {isNew && (
                      <span className="profile-new-badge">✦ Nuevo en ListoRD</span>
                    )}
                  </div>

                  {/* Quick identity */}
                  <div style={{ padding: "1.375rem 1.5rem 1.5rem" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "1rem" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem,4vw,2rem)", fontWeight: 400, letterSpacing: "-0.025em", color: "var(--ink)", lineHeight: 1.1 }}>
                          {fullName}
                        </h1>
                        <p style={{ marginTop: "0.3rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--green)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--green)", opacity: 0.85 }} />
                          {primarySkill}
                        </p>
                      </div>
                      <span className="profile-verified-pill">✓ Verificado</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
                      <div style={{ borderRadius: "var(--r-lg)", border: "1px solid var(--border)", background: "var(--surface)", padding: "0.75rem" }}>
                        <p style={{ fontSize: "0.67rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(26,61,43,0.45)", marginBottom: "0.2rem" }}>Ciudad</p>
                        <p style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--ink)" }}>{city}</p>
                      </div>
                      <div style={{ borderRadius: "var(--r-lg)", border: "1px solid var(--border)", background: "var(--surface)", padding: "0.75rem" }}>
                        <p style={{ fontSize: "0.67rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(26,61,43,0.45)", marginBottom: "0.2rem" }}>Tarifa</p>
                        <p style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--green)" }}>{formatIncomeShort(worker.desired_income)}</p>
                      </div>
                    </div>

                    {memberSince && (
                      <p style={{ marginTop: "0.75rem", fontSize: "0.72rem", fontWeight: 700, color: "rgba(26,61,43,0.4)" }}>
                        Miembro desde {memberSince}
                      </p>
                    )}
                  </div>
                </div>

                {/* Share card */}
                <div className="profile-share-card">
                  <p className="profile-share-eyebrow">¿Eres tú en este perfil?</p>
                  <p className="profile-share-headline">Comparte y consigue más clientes hoy</p>
                  <p className="profile-share-body">
                    Publica en WhatsApp Status, Facebook o Messenger — tus contactos pueden contratarte directo.
                  </p>
                  <ShareProfileButton
                    profileUrl={profileUrl}
                    workerName={fullName}
                    primarySkill={primarySkill}
                    city={city}
                    variant="primary"
                  />
                </div>

              </div>

              {/* RIGHT: About + Skills + How + Trust + CTA */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                {/* About */}
                {worker.short_intro && (
                  <div style={{ borderRadius: "var(--r-xl)", border: "1px solid var(--border)", background: "var(--surface-pure)", padding: "1.5rem", boxShadow: "var(--shadow-xs)" }}>
                    <p className="section-eyebrow" style={{ marginBottom: "0.75rem" }}>Sobre mí</p>
                    <p style={{ lineHeight: 1.7, color: "rgba(26,61,43,0.75)", fontSize: "1rem" }}>{worker.short_intro}</p>
                  </div>
                )}

                {/* Skills */}
                {(supportingSkills.length > 0 || workStyle) && (
                  <div style={{ borderRadius: "var(--r-xl)", border: "1px solid var(--border)", background: "var(--surface-pure)", padding: "1.5rem", boxShadow: "var(--shadow-xs)" }}>
                    <p className="section-eyebrow" style={{ marginBottom: "0.75rem" }}>Habilidades</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                      {supportingSkills.map((skill) => (
                        <span
                          key={skill}
                          style={{
                            display: "inline-flex", alignItems: "center",
                            padding: "0.3rem 0.875rem",
                            borderRadius: "var(--r-full)",
                            border: "1px solid var(--border)",
                            background: "var(--green-bg)",
                            fontSize: "0.82rem", fontWeight: 700,
                            color: "var(--ink)",
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                      {workStyle && (
                        <span
                          style={{
                            display: "inline-flex", alignItems: "center",
                            padding: "0.3rem 0.875rem",
                            borderRadius: "var(--r-full)",
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            fontSize: "0.82rem", fontWeight: 700,
                            color: "var(--ink)",
                          }}
                        >
                          {workStyleLabels[workStyle]}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* How to contact */}
                <div style={{ borderRadius: "var(--r-xl)", border: "1px solid var(--border)", background: "var(--surface-pure)", padding: "1.5rem", boxShadow: "var(--shadow-xs)" }}>
                  <p className="section-eyebrow" style={{ marginBottom: "1rem" }}>Cómo contactar</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    {HOW_IT_WORKS.map(({ step, text }) => (
                      <div key={step} className="profile-how-step">
                        <span className="profile-how-num">{step}</span>
                        <p style={{ fontSize: "0.88rem", fontWeight: 600, lineHeight: 1.6, color: "rgba(26,61,43,0.7)" }}>{text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verification trust */}
                <div className="profile-trust-card">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
                    <span className="profile-trust-icon">✓</span>
                    <div>
                      <p style={{ fontWeight: 800, color: "var(--ink)", marginBottom: "0.375rem" }}>Perfil revisado por nuestro equipo</p>
                      <p style={{ fontSize: "0.83rem", lineHeight: 1.65, color: "rgba(26,61,43,0.65)" }}>
                        Cada perfil en ListoRD es verificado manualmente antes de publicarse. Sin bots, sin perfiles falsos. Estás hablando con una persona real en República Dominicana.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contact CTA */}
                <WorkerProfileContactButton
                  workerId={worker.id}
                  workerName={fullName}
                  primarySkill={primarySkill}
                />

              </div>

            </div>
          </div>
        </section>

      </main>
    </>
  );
}
