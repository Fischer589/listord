import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getMissingProfileQualityFields,
  isValidEditToken
} from "@/lib/worker-profile";

type RegisteredWorkerQuality = {
  id: string;
  short_intro: string | null;
  skills: string[] | null;
  photo_url: string | null;
};

async function findWorkerByEditToken(token: string) {
  if (!token || !isValidEditToken(token)) {
    return null;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("workers")
    .select("id, short_intro, skills, photo_url")
    .eq("edit_token", token)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data as RegisteredWorkerQuality | null) ?? null;
}

export default async function WorkerRegistrationSuccessPage({
  searchParams
}: {
  searchParams: { token?: string };
}) {
  const editToken = searchParams.token?.trim() || "";
  const workerData = await findWorkerByEditToken(editToken);
  const missingProfileQualityFields = workerData
    ? getMissingProfileQualityFields(workerData)
    : [];
  const editLink =
    workerData && isValidEditToken(editToken)
      ? `/trabajadores/editar?token=${encodeURIComponent(editToken)}`
      : "";
  const profileLink = workerData?.id
    ? `https://listordapp.com/trabajador/${workerData.id}`
    : "https://listordapp.com";
  const shareText = encodeURIComponent(
    `Mira mi perfil en ListoRD 👇\n${profileLink}\nEstoy disponible para trabajar en RD — contáctame directo por WhatsApp.`
  );

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Success banner */}
        <section className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-soft">
          <p className="text-4xl">🎉</p>
          <h1 className="mt-3 text-3xl font-black text-green-900">
            ¡Listo! Recibimos tu perfil.
          </h1>
          <p className="mt-3 text-lg font-semibold leading-7 text-green-800">
            Lo revisamos y te avisaremos por WhatsApp cuando estés visible en
            ListoRD. Generalmente en menos de 24 horas.
          </p>
        </section>

        {/* Missing quality fields nudge */}
        {missingProfileQualityFields.length > 0 && (
          <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-black text-amber-900">
              💡 Completa tu perfil para recibir más clientes
            </p>
            <ul className="mt-2 space-y-1 text-sm font-semibold text-amber-800">
              {missingProfileQualityFields.includes("photo") && (
                <li>• Agrega una foto de perfil — sube 3× más contactos</li>
              )}
              {missingProfileQualityFields.includes("short_intro") && (
                <li>• Escribe una descripción corta sobre ti</li>
              )}
              {missingProfileQualityFields.includes("skills") && (
                <li>• Agrega tus habilidades principales</li>
              )}
            </ul>
            {editLink && (
              <Link
                href={editLink}
                className="tap-target mt-4 inline-flex items-center rounded-xl bg-amber-600 px-4 py-3 font-black text-white"
              >
                Completar mi perfil →
              </Link>
            )}
          </section>
        )}

        {/* Share loop */}
        <section className="mt-4 rounded-2xl border border-hoja/25 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-black text-ink">
            Comparte tu perfil para que más personas te vean
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/65">
            Cuantas más personas vean tu perfil, más rápido consigues clientes.
            Compártelo en tu estado de WhatsApp, grupos de familia o redes
            sociales.
          </p>
          {workerData?.id && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-hoja/20 bg-cielo/50 p-3">
              <span className="text-xs font-black text-ink/50">Tu enlace:</span>
              <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-black text-hoja">
                {profileLink}
              </code>
            </div>
          )}
          <a
            href={`https://wa.me/?text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-target mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f7a4c] px-4 py-4 font-black text-white hover:bg-[#17613c] sm:w-fit"
          >
            <WhatsAppIcon />
            Compartir mi perfil por WhatsApp
          </a>
        </section>

        {/* Edit link */}
        {editLink && (
          <section className="mt-4 rounded-2xl border border-[rgba(31,31,28,0.07)] bg-white p-5 shadow-soft">
            <h2 className="font-black text-ink">
              Guarda tu enlace para editar el perfil
            </h2>
            <p className="mt-1 text-sm font-semibold text-ink/55">
              Guárdalo en WhatsApp o notas. Lo necesitarás si quieres hacer
              cambios.
            </p>
            <Link
              href={editLink}
              className="mt-3 block break-all rounded-xl border border-hoja/25 bg-cielo/50 px-4 py-3 text-sm font-black text-hoja"
            >
              {editLink}
            </Link>
          </section>
        )}

        {/* Recover link */}
        <section className="mt-4 rounded-2xl border border-[rgba(31,31,28,0.07)] bg-white p-5 shadow-soft">
          <h2 className="font-black text-ink">¿Perdiste tu enlace?</h2>
          <p className="mt-1 text-sm font-semibold text-ink/55">
            Recupéralo con tu número de WhatsApp.
          </p>
          <Link
            href="/trabajadores/recuperar"
            className="tap-target mt-3 inline-flex items-center rounded-xl border border-hoja/30 bg-white px-4 py-3 font-black text-hoja shadow-soft hover:bg-cielo"
          >
            Recuperar enlace →
          </Link>
        </section>
      </main>
    </>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="h-5 w-5 shrink-0"
      fill="currentColor"
    >
      <path d="M16.03 3.5A12.38 12.38 0 0 0 5.44 22.3L4 28.5l6.36-1.38A12.36 12.36 0 1 0 16.03 3.5Zm0 22.5a10.05 10.05 0 0 1-5.12-1.4l-.36-.22-3.75.82.85-3.58-.24-.38A10.06 10.06 0 1 1 16.03 26Zm5.76-7.53c-.31-.16-1.85-.91-2.13-1.02-.29-.1-.49-.16-.7.16-.2.31-.8 1.02-.98 1.23-.18.2-.36.23-.67.08-.31-.16-1.32-.49-2.51-1.55a9.44 9.44 0 0 1-1.73-2.15c-.18-.31-.02-.48.14-.64.14-.14.31-.36.47-.54.16-.18.2-.31.31-.52.1-.2.05-.39-.03-.54-.08-.16-.7-1.68-.96-2.3-.25-.6-.51-.52-.7-.53h-.6c-.2 0-.54.08-.83.39-.29.31-1.09 1.06-1.09 2.59s1.12 3.01 1.27 3.22c.16.2 2.2 3.36 5.34 4.72.75.32 1.33.51 1.78.65.75.24 1.43.2 1.97.12.6-.09 1.85-.76 2.11-1.49.26-.73.26-1.35.18-1.49-.08-.13-.29-.2-.6-.36Z" />
    </svg>
  );
}
