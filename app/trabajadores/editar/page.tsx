import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { WorkStyle } from "@/lib/types";
import {
  getList,
  getMissingProfileQualityFields,
  getText,
  getWorkStyleValue,
  hasBlockedText,
  isValidEditToken,
  normalizeWhatsAppNumber,
  uploadWorkerPhoto,
  workStyles
} from "@/lib/worker-profile";

type EditableWorker = {
  id: string;
  edit_token: string;
  is_verified: boolean;
  full_name: string;
  whatsapp_number: string | null;
  city: string;
  skills: string[];
  desired_income: number;
  availability: string[];
  short_intro: string;
  work_style: WorkStyle | null;
  photo_url: string | null;
};

const workerProfileSaveError =
  "No pudimos guardar tu perfil ahora. Intenta de nuevo o escríbenos por WhatsApp.";

function isDuplicateWhatsAppError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("workers_whatsapp_digits_unique_idx")
  );
}

function getEditRedirect(token: string, state: string) {
  if (!isValidEditToken(token)) {
    return `/trabajadores/editar?estado=${state}`;
  }

  const encodedToken = encodeURIComponent(token);

  return `/trabajadores/editar?token=${encodedToken}&estado=${state}`;
}

async function findWorkerByEditToken(token?: string) {
  const editToken = token?.trim() || "";

  if (!editToken) {
    return null;
  }

  if (!isValidEditToken(editToken)) {
    return null;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    console.warn("Worker edit lookup skipped: Supabase admin client unavailable.");
    return null;
  }

  const { data, error } = await supabase
    .from("workers")
    .select(`
      id,
      edit_token,
      is_verified,
      full_name,
      whatsapp_number,
      city,
      skills,
      desired_income,
      availability,
      short_intro,
      work_style,
      photo_url
    `)
    .eq("edit_token", editToken)
    .maybeSingle();

  if (error) {
    console.warn("Worker edit lookup failed.", {
      code: error.code
    });
    return null;
  }

  return (data as EditableWorker | null) ?? null;
}

async function updateWorkerProfile(formData: FormData) {
  "use server";

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    console.warn("Worker profile update skipped: Supabase admin client unavailable.");
    redirect("/trabajadores/editar?estado=error");
  }

  const editToken = getText(formData, "edit_token");
  const fullName = getText(formData, "full_name");
  const city = getText(formData, "city");
  const whatsappNumber = getText(formData, "whatsapp_number");
  const skills = getList(formData, "skills");
  const availability = getList(formData, "availability");
  const desiredIncome = Number(getText(formData, "desired_income"));
  const shortIntro = getText(formData, "short_intro");
  const workStyle = getWorkStyleValue(getText(formData, "work_style"));
  const normalizedWhatsAppNumber = normalizeWhatsAppNumber(whatsappNumber);
  const currentWorker = await findWorkerByEditToken(editToken);

  if (!currentWorker) {
    redirect(getEditRedirect(editToken, "token_invalido"));
  }

  if (
    fullName.length < 2 ||
    !city ||
    !whatsappNumber ||
    skills.length === 0 ||
    !Number.isFinite(desiredIncome) ||
    desiredIncome <= 0 ||
    availability.length === 0 ||
    shortIntro.length < 20 ||
    !workStyle
  ) {
    redirect(getEditRedirect(editToken, "incompleto"));
  }

  if (!normalizedWhatsAppNumber) {
    redirect(getEditRedirect(editToken, "telefono"));
  }

  if (
    hasBlockedText([
      fullName,
      city,
      skills.join(" "),
      availability.join(" "),
      shortIntro
    ])
  ) {
    redirect(getEditRedirect(editToken, "rechazado"));
  }

  const { data: existingWorkers, error: duplicateCheckError } = await supabase
    .from("workers")
    .select("id, whatsapp_number")
    .not("whatsapp_number", "is", null);

  if (duplicateCheckError) {
    console.warn("Worker profile update duplicate check skipped.", {
      code: duplicateCheckError.code
    });
  }

  const hasDuplicate = (existingWorkers ?? []).some((worker) => {
    const existingNumber =
      typeof worker.whatsapp_number === "string"
        ? normalizeWhatsAppNumber(worker.whatsapp_number)
        : null;

    return (
      worker.id !== currentWorker.id &&
      existingNumber === normalizedWhatsAppNumber
    );
  });

  if (hasDuplicate) {
    redirect(getEditRedirect(editToken, "duplicado"));
  }

  const photoUrl = await uploadWorkerPhoto(
    supabase,
    formData.get("profile_photo"),
    normalizedWhatsAppNumber
  );

  const profileContentChanged =
    currentWorker.full_name !== fullName ||
    currentWorker.city !== city ||
    normalizeWhatsAppNumber(currentWorker.whatsapp_number || "") !==
      normalizedWhatsAppNumber ||
    JSON.stringify(currentWorker.skills || []) !== JSON.stringify(skills) ||
    currentWorker.desired_income !== desiredIncome ||
    JSON.stringify(currentWorker.availability || []) !==
      JSON.stringify(availability) ||
    currentWorker.short_intro !== shortIntro ||
    currentWorker.work_style !== workStyle;

  const updatePayload: Record<string, unknown> = {
    full_name: fullName,
    city,
    whatsapp_number: `+${normalizedWhatsAppNumber}`,
    skills,
    desired_income: desiredIncome,
    availability,
    work_style: workStyle,
    short_intro: shortIntro
  };

  if (photoUrl) {
    updatePayload.photo_url = photoUrl;
  }

  if (currentWorker.is_verified && (profileContentChanged || photoUrl)) {
    updatePayload.is_verified = false;
  }

  const { data: updatedWorker, error } = await supabase
    .from("workers")
    .update(updatePayload)
    .eq("id", currentWorker.id)
    .eq("edit_token", editToken)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("Worker profile update failed.", {
      code: error.code
    });
    if (isDuplicateWhatsAppError(error)) {
      redirect(getEditRedirect(editToken, "duplicado"));
    }

    redirect(getEditRedirect(editToken, "error"));
  }

  if (!updatedWorker) {
    console.warn("Worker profile update did not match a worker.", {
      workerId: currentWorker.id,
      hasEditToken: Boolean(editToken)
    });
    redirect(getEditRedirect(editToken, "error"));
  }

  redirect(getEditRedirect(editToken, "actualizado"));
}

export default async function EditWorkerPage({
  searchParams
}: {
  searchParams: { token?: string; estado?: string };
}) {
  const token = searchParams.token?.trim() || "";
  const state = searchParams.estado;
  const worker = await findWorkerByEditToken(token);
  const missingProfileQualityFields = worker
    ? getMissingProfileQualityFields(worker)
    : [];

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/" className="text-sm font-bold text-hoja">
          Volver
        </Link>
        <h1 className="mt-3 text-3xl font-black">Editar mi perfil</h1>
        <p className="mt-2 leading-7 text-black/70">
          Usa el enlace de edicion que recibiste al registrarte. Si haces
          cambios importantes, el perfil vuelve a revision antes de publicarse.
        </p>

        {state === "actualizado" && (
          <div className="mt-5 rounded-lg border border-hoja/30 bg-hoja/10 p-4 font-bold text-ink">
            Perfil actualizado. Lo revisaremos otra vez y te avisaremos por
            WhatsApp cuando sea aprobado.
          </div>
        )}
        {state === "incompleto" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Completa nombre, descripcion y todos los campos requeridos.
          </div>
        )}
        {state === "telefono" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Usa un numero de WhatsApp valido de RD: 809, 829 o 849.
          </div>
        )}
        {state === "duplicado" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Ese WhatsApp ya esta usado por otro perfil.
          </div>
        )}
        {state === "rechazado" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Revisa el texto del perfil. No aceptamos lenguaje ofensivo o spam.
          </div>
        )}
        {state === "error" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            {workerProfileSaveError}
          </div>
        )}
        {state === "token_invalido" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Este enlace no es válido o ya no está disponible. Puedes solicitar
            ayuda para recuperarlo.
          </div>
        )}

        {!worker && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
            <p className="font-bold">Enlace inválido</p>
            <Link
              href="/trabajadores/recuperar"
              className="mt-3 inline-flex tap-target rounded-md bg-ink px-4 py-2 font-black text-white"
            >
              Recuperar enlace
            </Link>
          </div>
        )}

        {worker && (
          <>
            {missingProfileQualityFields.length > 0 && (
              <div className="mt-5 rounded-lg border border-mango/40 bg-mango/15 p-4 font-bold text-ink">
                Completa tu perfil para recibir más clientes
              </div>
            )}

            <form
              action={updateWorkerProfile}
              encType="multipart/form-data"
              className="mt-6 grid gap-4 rounded-lg border border-black/10 bg-white p-4 shadow-soft"
            >
              <input type="hidden" name="edit_token" value={worker.edit_token} />
              <label className="grid gap-1 font-bold">
                Nombre completo
                <input
                  className="tap-target rounded-md border border-black/15 px-3"
                  name="full_name"
                  defaultValue={worker.full_name}
                  required
                />
              </label>

            <label className="grid gap-1 font-bold">
              <span>
                Foto de perfil{" "}
                <span className="font-semibold text-black/55">(opcional)</span>
              </span>
              <input
                className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm font-semibold"
                name="profile_photo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
              />
              <span className="text-xs font-semibold text-black/55">
                Si subes una nueva foto, reemplaza la anterior despues de
                guardar.
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 font-bold">
                Ciudad
                <input
                  className="tap-target rounded-md border border-black/15 px-3"
                  name="city"
                  defaultValue={worker.city}
                  required
                />
              </label>
              <label className="grid gap-1 font-bold">
                Numero de WhatsApp
                <input
                  className="tap-target rounded-md border border-black/15 px-3"
                  name="whatsapp_number"
                  inputMode="tel"
                  autoComplete="tel"
                  defaultValue={worker.whatsapp_number || ""}
                  required
                />
              </label>
            </div>

            <label className="grid gap-1 font-bold">
              Habilidades
              <textarea
                className="min-h-24 rounded-md border border-black/15 p-3"
                name="skills"
                defaultValue={(worker.skills || []).join(", ")}
                required
              />
            </label>

            <label className="grid gap-1 font-bold">
              Ingreso deseado por dia
              <input
                className="tap-target rounded-md border border-black/15 px-3"
                name="desired_income"
                inputMode="numeric"
                defaultValue={worker.desired_income}
                required
              />
            </label>

            <label className="grid gap-1 font-bold">
              Disponibilidad
              <textarea
                className="min-h-24 rounded-md border border-black/15 p-3"
                name="availability"
                defaultValue={(worker.availability || []).join(", ")}
                required
              />
            </label>

            <label className="grid gap-1 font-bold">
              Descripcion corta
              <textarea
                className="min-h-28 rounded-md border border-black/15 p-3"
                name="short_intro"
                defaultValue={worker.short_intro}
                minLength={20}
                required
              />
            </label>

            <label className="grid gap-1 font-bold">
              Estilo de trabajo
              <select
                className="tap-target rounded-md border border-black/15 px-3"
                name="work_style"
                defaultValue={worker.work_style || ""}
                required
              >
                <option value="" disabled>
                  Selecciona uno
                </option>
                {workStyles.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="tap-target rounded-md bg-hoja px-4 py-3 font-black text-white">
              Guardar cambios
            </button>
            <p className="text-xs font-semibold text-black/55">
              Al guardar, tu perfil queda pendiente de aprobacion otra vez.
            </p>
            </form>
          </>
        )}
      </main>
    </>
  );
}
