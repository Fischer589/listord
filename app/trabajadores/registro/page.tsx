import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getList,
  getText,
  hasBlockedText,
  isValidEditToken,
  normalizeWhatsAppNumber,
  uploadWorkerPhoto,
  workStyles
} from "@/lib/worker-profile";
import type { WorkStyle } from "@/lib/types";

const workerProfileUnexpectedError =
  "No pudimos completar el registro ahora. Intenta de nuevo o escríbenos por WhatsApp.";

function isDuplicateWhatsAppError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("workers_whatsapp_digits_unique_idx")
  );
}

async function submitWorkerRegistration(formData: FormData) {
  "use server";

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    console.warn("Worker registration skipped: Supabase admin client unavailable.");
    redirect("/trabajadores/registro?estado=error");
  }

  const fullName = getText(formData, "full_name");
  const city = getText(formData, "city");
  const whatsappNumber = getText(formData, "whatsapp_number");
  const skills = getList(formData, "skills");
  const availability = getList(formData, "availability");
  const desiredIncome = Number(getText(formData, "desired_income"));
  const shortIntro = getText(formData, "short_intro");
  const workStyle = getText(formData, "work_style") as WorkStyle;
  const workStyleNote = getText(formData, "work_style_note");
  const normalizedWhatsAppNumber = normalizeWhatsAppNumber(whatsappNumber);
  const editToken = crypto.randomUUID();

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
    redirect("/trabajadores/registro?estado=incompleto");
  }

  if (!normalizedWhatsAppNumber) {
    redirect("/trabajadores/registro?estado=telefono");
  }

  if (
    hasBlockedText([
      fullName,
      city,
      skills.join(" "),
      availability.join(" "),
      shortIntro,
      workStyleNote
    ])
  ) {
    redirect("/trabajadores/registro?estado=rechazado");
  }

  const { data: existingWorkers, error: duplicateCheckError } = await supabase
    .from("workers")
    .select("id, whatsapp_number")
    .not("whatsapp_number", "is", null);

  if (duplicateCheckError) {
    console.warn("Worker registration duplicate check skipped.", {
      code: duplicateCheckError.code
    });
  }

  const hasDuplicate = (existingWorkers ?? []).some((worker) => {
    const existingNumber =
      typeof worker.whatsapp_number === "string"
        ? normalizeWhatsAppNumber(worker.whatsapp_number)
        : null;

    return existingNumber === normalizedWhatsAppNumber;
  });

  if (hasDuplicate) {
    redirect("/trabajadores/registro?estado=duplicado");
  }

  const photoUrl = await uploadWorkerPhoto(
    supabase,
    formData.get("profile_photo"),
    normalizedWhatsAppNumber
  );

  const { data: insertedWorker, error } = await supabase
    .from("workers")
    .insert({
      edit_token: editToken,
      full_name: fullName,
      photo_url: photoUrl,
      city,
      whatsapp_number: `+${normalizedWhatsAppNumber}`,
      skills,
      desired_income: desiredIncome,
      income_type: "daily",
      availability,
      available_now: false,
      work_style: workStyle,
      work_style_note: workStyleNote || null,
      job_duration_preference: availability.join(", "),
      short_intro: shortIntro,
      is_verified: false
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Worker registration insert failed.", {
      code: error.code
    });
    if (isDuplicateWhatsAppError(error)) {
      redirect("/trabajadores/registro?estado=duplicado");
    }

    redirect("/trabajadores/registro?estado=error");
  }

  if (!insertedWorker?.id || !isValidEditToken(editToken)) {
    console.warn("Worker registration insert returned no worker id.");
    redirect("/trabajadores/registro?estado=error");
  }

  redirect(
    `/trabajadores/registro-exitoso?token=${encodeURIComponent(editToken)}`
  );
}

export default function WorkerRegistrationPage({
  searchParams
}: {
  searchParams: { estado?: string };
}) {
  const state = searchParams.estado;

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/" className="text-sm font-bold text-hoja">
          Volver
        </Link>
        <h1 className="mt-3 text-3xl font-black">Registrarme como trabajador</h1>
        <p className="mt-2 leading-7 text-black/70">
          Recibimos tu informacion y la revisamos antes de mostrarla
          publicamente en ListoRD.
        </p>

        {state === "incompleto" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Completa nombre, descripcion y todos los campos requeridos para
            enviar tu registro.
          </div>
        )}
        {state === "telefono" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Usa un numero de WhatsApp valido de RD: 809, 829 o 849.
          </div>
        )}
        {state === "duplicado" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Ese WhatsApp ya fue registrado. No se puede enviar el mismo perfil
            dos veces.
          </div>
        )}
        {state === "rechazado" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Revisa el texto del perfil. No aceptamos lenguaje ofensivo o spam.
          </div>
        )}
        {state === "error" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            {workerProfileUnexpectedError}
          </div>
        )}

        <form
          action={submitWorkerRegistration}
          encType="multipart/form-data"
          className="mt-5 grid gap-4 rounded-lg border border-black/10 bg-white p-4 shadow-soft"
        >
          <label className="grid gap-1 font-bold">
            Nombre completo
            <input
              className="tap-target rounded-md border border-black/15 px-3"
              name="full_name"
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
              PNG, JPG, WEBP o GIF. Maximo 5 MB.
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 font-bold">
              Ciudad
              <input
                className="tap-target rounded-md border border-black/15 px-3"
                name="city"
                placeholder="Santo Domingo"
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
                placeholder="809, 829 o 849..."
                required
              />
            </label>
          </div>

          <label className="grid gap-1 font-bold">
            Habilidades
            <textarea
              className="min-h-24 rounded-md border border-black/15 p-3"
              name="skills"
              placeholder="Limpieza, cocina, construccion"
              required
            />
          </label>

          <label className="grid gap-1 font-bold">
            Ingreso deseado por dia
            <input
              className="tap-target rounded-md border border-black/15 px-3"
              name="desired_income"
              inputMode="numeric"
              placeholder="1800"
              required
            />
          </label>

          <label className="grid gap-1 font-bold">
            Disponibilidad
            <textarea
              className="min-h-24 rounded-md border border-black/15 p-3"
              name="availability"
              placeholder="Hoy, mananas, fines de semana"
              required
            />
          </label>

          <label className="grid gap-1 font-bold">
            Descripcion corta
            <textarea
              className="min-h-28 rounded-md border border-black/15 p-3"
              name="short_intro"
              placeholder="Soy puntual, tengo experiencia en..."
              minLength={20}
              required
            />
          </label>

          <label className="grid gap-1 font-bold">
            Estilo de trabajo
            <select
              className="tap-target rounded-md border border-black/15 px-3"
              name="work_style"
              defaultValue=""
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

          <label className="grid gap-1 font-bold">
            Como trabajas mejor
            <textarea
              className="min-h-24 rounded-md border border-black/15 p-3"
              name="work_style_note"
              placeholder="Ejemplo: me gusta trabajar con instrucciones claras y cumplir a tiempo."
            />
          </label>

          <button className="tap-target rounded-md bg-hoja px-4 py-3 font-black text-white">
            Enviar registro
          </button>
          <p className="text-xs font-semibold text-black/55">
            Tu perfil se guarda como pendiente y no aparece publicamente hasta
            que sea aprobado.
          </p>
        </form>
      </main>
    </>
  );
}
