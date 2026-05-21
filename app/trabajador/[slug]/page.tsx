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

      <main className="container py-8 md:py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-hoja hover:underline">
          ← Volver al inicio
        </Link>

        <div className="mt-5 grid gap-6 md:grid-cols-[320px_1fr] md:items-start">

          {/* ── LEFT: Photo card + Share card ── */}
          <div className="flex flex-col gap-4">

            {/* Profile card */}
            <div className="overflow-hidden rounded-2xl border border-[rgba(31,31,28,0.07)] bg-white shadow-soft">
              {/* Photo */}
              <div className="profile-photo-wrap">
                {worker.photo_url ? (
                  <Image
                    src={worker.photo_url}
                    alt={`Foto de ${fullName}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 320px"
                    className="object-contain object-center"
                    priority
                  />
                ) : (
                  <div className="profile-photo-fallback">
                    {getInitials(fullName)}
                  </div>
                )}
                {/* Activity signal */}
                {isNew && (
                  <span className="profile-new-badge">✦ Nuevo en ListoRD</span>
                )}
              </div>

              {/* Quick info */}
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-black text-ink">{fullName}</h1>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-black text-hoja">
                      <span className="inline-block h-2 w-2 rounded-full bg-hoja/70" />
                      {primarySkill}
                    </p>
                  </div>
                  <span className="profile-verified-pill">✓ Verificado</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-[rgba(31,31,28,0.07)] bg-crema p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-ink/50">
                      Ciudad
                    </p>
                    <p className="mt-0.5 font-black text-ink">{city}</p>
                  </div>
                  <div className="rounded-xl border border-[rgba(31,31,28,0.07)] bg-crema p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-ink/50">
                      Tarifa
                    </p>
                    <p className="mt-0.5 font-black text-hoja">
                      {formatIncomeShort(worker.desired_income)}
                    </p>
                  </div>
                </div>

                {memberSince && (
                  <p className="mt-3 text-xs font-bold text-ink/40">
                    Miembro desde {memberSince}
                  </p>
                )}
              </div>
            </div>

            {/* ── Share motivation card ── */}
            <div className="profile-share-card">
              <p className="profile-share-eyebrow">¿Eres tú en este perfil?</p>
              <p className="profile-share-headline">
                Comparte y consigue más clientes hoy
              </p>
              <p className="profile-share-body">
                Publica en WhatsApp Status, Facebook o Messenger — tus contactos
                pueden contratarte directo.
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

          {/* ── RIGHT: About + Skills + How + Trust + CTA ── */}
          <div className="flex flex-col gap-5">

            {/* About */}
            {worker.short_intro && (
              <div className="rounded-2xl border border-[rgba(31,31,28,0.07)] bg-white p-5 shadow-soft">
                <p className="text-sm font-black uppercase tracking-wide text-hoja">
                  Sobre mí
                </p>
                <p className="mt-3 leading-7 text-ink/80">{worker.short_intro}</p>
              </div>
            )}

            {/* Skills */}
            {(supportingSkills.length > 0 || workStyle) && (
              <div className="rounded-2xl border border-[rgba(31,31,28,0.07)] bg-white p-5 shadow-soft">
                <p className="text-sm font-black uppercase tracking-wide text-hoja">
                  Habilidades
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {supportingSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-[rgba(31,31,28,0.07)] bg-sage/20 px-3 py-1.5 text-sm font-black text-ink/80"
                    >
                      {skill}
                    </span>
                  ))}
                  {workStyle && (
                    <span className="rounded-full border border-[rgba(31,31,28,0.07)] bg-cielo px-3 py-1.5 text-sm font-black text-ink/80">
                      {workStyleLabels[workStyle]}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* How to contact — for employers arriving cold */}
            <div className="rounded-2xl border border-[rgba(31,31,28,0.07)] bg-white p-5 shadow-soft">
              <p className="text-sm font-black uppercase tracking-wide text-hoja">
                Cómo contactar
              </p>
              <div className="mt-4 grid gap-3">
                {HOW_IT_WORKS.map(({ step, text }) => (
                  <div key={step} className="profile-how-step">
                    <span className="profile-how-num">{step}</span>
                    <p className="text-sm font-bold leading-6 text-ink/75">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification trust */}
            <div className="profile-trust-card">
              <div className="flex items-start gap-3">
                <span className="profile-trust-icon">✓</span>
                <div>
                  <p className="font-black text-ink">
                    Perfil revisado por nuestro equipo
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-ink/62">
                    Cada perfil en ListoRD es verificado manualmente antes de
                    publicarse. Sin bots, sin perfiles falsos. Estás hablando
                    con una persona real en República Dominicana.
                  </p>
                </div>
              </div>
            </div>

            {/* WhatsApp contact CTA */}
            <WorkerProfileContactButton
              workerId={worker.id}
              workerName={fullName}
              primarySkill={primarySkill}
            />

          </div>
        </div>
      </main>
    </>
  );
}
