import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getMissingProfileQualityFields,
  isValidEditToken
} from "@/lib/worker-profile";

type RegisteredWorkerQuality = {
  short_intro: string | null;
  skills: string[] | null;
  photo_url: string | null;
};

async function findWorkerQualityByEditToken(token: string) {
  if (!token || !isValidEditToken(token)) {
    return null;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("workers")
    .select("short_intro, skills, photo_url")
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
  const workerQuality = await findWorkerQualityByEditToken(editToken);
  const missingProfileQualityFields = workerQuality
    ? getMissingProfileQualityFields(workerQuality)
    : [];
  const editLink = workerQuality && isValidEditToken(editToken)
    ? `/trabajadores/editar?token=${encodeURIComponent(editToken)}`
    : "";
  const shareText = encodeURIComponent(
    "ListoRD esta recibiendo perfiles de trabajadores. Registrate aqui: /trabajadores/registro"
  );

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <section className="rounded-lg border border-hoja/30 bg-hoja/10 p-5 text-ink shadow-soft">
          <h1 className="text-3xl font-black">✅ Registro recibido</h1>
          <p className="mt-3 text-lg font-semibold leading-7">
            Estamos revisando tu perfil. Te avisaremos por WhatsApp cuando sea
            aprobado.
          </p>

          {missingProfileQualityFields.length > 0 && (
            <div className="mt-5 rounded-md border border-mango/40 bg-mango/15 p-4 font-bold text-ink">
              Completa tu perfil para recibir más clientes
            </div>
          )}

          {editLink && (
            <div className="mt-5 grid gap-2 rounded-md border border-hoja/30 bg-white p-4">
              <p className="font-bold">
                Guarda este enlace para editar tu perfil
              </p>
              <p className="text-sm font-semibold text-black/65">
                Te recomendamos guardarlo en WhatsApp o notas
              </p>
              <Link
                href={editLink}
                className="break-all rounded-md border border-hoja/30 bg-hoja/5 px-3 py-2 font-bold text-hoja"
              >
                {editLink}
              </Link>
            </div>
          )}

          <div className="mt-5 grid gap-3 rounded-md border border-mango/40 bg-mango/15 p-4">
            <p className="font-bold">
              Comparte esto con otros que busquen trabajo
            </p>
            <a
              href={`https://wa.me/?text=${shareText}`}
              className="inline-flex tap-target w-fit items-center rounded-md bg-ink px-4 py-3 font-black text-white"
            >
              Compartir por WhatsApp
            </a>
          </div>

          <div className="mt-5 rounded-md border border-black/10 bg-white p-4">
            <p className="font-bold">
              ¿Perdiste tu enlace? Recupéralo con tu número de WhatsApp
            </p>
            <Link
              href="/trabajadores/recuperar"
              className="mt-2 inline-flex tap-target items-center rounded-md bg-hoja px-4 py-2 font-black text-white"
            >
              Recuperar enlace
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
