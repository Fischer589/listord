import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { WorkerProfileContactButton } from "@/components/worker-profile-contact-button";
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
  photo_url
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

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "LR";
}

function getSkills(worker: ProfileRow) {
  return Array.isArray(worker.skills)
    ? worker.skills.map((s) => s.trim()).filter(Boolean)
    : [];
}

export async function generateMetadata({
  params
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const worker = await getWorkerProfile(params.slug);
  if (!worker) return { title: "Perfil no encontrado | ListoRD" };

  const name = worker.full_name || "Trabajador ListoRD";
  const skills = getSkills(worker);
  const primarySkill = skills[0] || "Trabajador disponible";
  const city = worker.city || "República Dominicana";

  return {
    title: `${name} — ${primarySkill} en ${city} | ListoRD`,
    description:
      worker.short_intro ||
      `Perfil verificado de ${name}. Disponible para trabajar en ${city} hoy.`,
    openGraph: {
      title: `${name} | ListoRD`,
      description:
        worker.short_intro ||
        `${primarySkill} disponible en ${city}. Contáctalo por WhatsApp.`,
      ...(worker.photo_url ? { images: [{ url: worker.photo_url }] } : {})
    }
  };
}

export default async function WorkerProfilePage({
  params
}: {
  params: { slug: string };
}) {
  const worker = await getWorkerProfile(params.slug);
  if (!worker) notFound();

  const fullName = worker.full_name || "Trabajador ListoRD";
  const city = worker.city || "República Dominicana";
  const skills = getSkills(worker);
  const primarySkill = skills[0] || "Trabajador disponible";
  const supportingSkills = skills.slice(1, 5);
  const workStyle =
    worker.work_style && worker.work_style in workStyleLabels
      ? (worker.work_style as WorkStyle)
      : null;
  const profileUrl = `https://listordapp.com/trabajador/${worker.id}`;
  const shareText = encodeURIComponent(
    `Mira mi perfil en ListoRD 👇\n${profileUrl}`
  );

  return (
    <>
      <AppHeader />
      <main className="container py-8">
        <Link
          href="/"
          className="text-sm font-bold text-hoja hover:underline"
        >
          ← Volver al inicio
        </Link>

        <div className="mt-5 grid gap-6 md:grid-cols-[320px_1fr] md:items-start">
          {/* ── LEFT: Photo + quick info ── */}
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-2xl border border-[rgba(31,31,28,0.07)] bg-white shadow-soft">
              <div className="relative h-64 w-full bg-gradient-to-br from-cielo to-[#e8f0e0]">
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
                  <div className="grid h-full w-full place-items-center text-5xl font-black text-hoja/60">
                    {getInitials(fullName)}
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h1 className="text-2xl font-black text-ink">{fullName}</h1>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-black text-hoja">
                      <span className="inline-block h-2 w-2 rounded-full bg-hoja/70" />
                      {primarySkill}
                    </p>
                  </div>
                  <span className="rounded-full bg-ink px-3 py-1 text-xs font-black text-white">
                    ✓ Verificado
                  </span>
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
              </div>
            </div>

            {/* Share button */}
            <a
              href={`https://wa.me/?text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tap-target flex w-full items-center justify-center gap-2 rounded-xl border border-hoja/30 bg-white px-4 py-3 text-sm font-black text-hoja shadow-soft hover:bg-cielo"
            >
              <WhatsAppIcon />
              Compartir este perfil
            </a>
          </div>

          {/* ── RIGHT: Details ── */}
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
                  Habilidades y estilo
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
                      Estilo: {workStyleLabels[workStyle]}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Trust */}
            <div className="rounded-2xl border border-hoja/20 bg-cielo/60 p-5">
              <p className="text-sm font-black uppercase tracking-wide text-hoja">
                Perfil verificado
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/70">
                Este perfil fue revisado manualmente por el equipo de ListoRD.
                Hablas directamente con la persona, sin intermediarios.
              </p>
            </div>

            {/* Contact CTA */}
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

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="h-4 w-4 shrink-0"
      fill="currentColor"
    >
      <path d="M16.03 3.5A12.38 12.38 0 0 0 5.44 22.3L4 28.5l6.36-1.38A12.36 12.36 0 1 0 16.03 3.5Zm0 22.5a10.05 10.05 0 0 1-5.12-1.4l-.36-.22-3.75.82.85-3.58-.24-.38A10.06 10.06 0 1 1 16.03 26Zm5.76-7.53c-.31-.16-1.85-.91-2.13-1.02-.29-.1-.49-.16-.7.16-.2.31-.8 1.02-.98 1.23-.18.2-.36.23-.67.08-.31-.16-1.32-.49-2.51-1.55a9.44 9.44 0 0 1-1.73-2.15c-.18-.31-.02-.48.14-.64.14-.14.31-.36.47-.54.16-.18.2-.31.31-.52.1-.2.05-.39-.03-.54-.08-.16-.7-1.68-.96-2.3-.25-.6-.51-.52-.7-.53h-.6c-.2 0-.54.08-.83.39-.29.31-1.09 1.06-1.09 2.59s1.12 3.01 1.27 3.22c.16.2 2.2 3.36 5.34 4.72.75.32 1.33.51 1.78.65.75.24 1.43.2 1.97.12.6-.09 1.85-.76 2.11-1.49.26-.73.26-1.35.18-1.49-.08-.13-.29-.2-.6-.36Z" />
    </svg>
  );
}
