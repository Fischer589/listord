import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { WorkerRegistrationForm } from "@/components/worker-registration-form";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getList,
  getText,
  getWorkStyleValue,
  hasBlockedText,
  isValidEditToken,
  normalizeWhatsAppNumber,
  uploadWorkerPhoto,
  workStyles
} from "@/lib/worker-profile";

export type WorkerRegistrationActionState = {
  supabaseError?: {
    message: string;
    details?: string | null;
    code?: string | null;
  };
};

const expectedWorkerInsertColumns = [
  "availability",
  "city",
  "desired_income",
  "edit_token",
  "full_name",
  "is_verified",
  "short_intro",
  "skills",
  "whatsapp_number",
  "work_style"
];

async function submitWorkerRegistration(
  _previousState: WorkerRegistrationActionState,
  formData: FormData
): Promise<WorkerRegistrationActionState> {
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
  const workStyle = getWorkStyleValue(getText(formData, "work_style"));
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
      shortIntro
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

  const insertPayload: {
    edit_token: string;
    full_name: string;
    city: string;
    whatsapp_number: string;
    skills: string[];
    desired_income: number;
    availability: string[];
    short_intro: string;
    work_style: NonNullable<typeof workStyle>;
    is_verified: false;
    photo_url?: string;
  } = {
    edit_token: editToken,
    full_name: fullName,
    city,
    whatsapp_number: normalizedWhatsAppNumber,
    skills,
    desired_income: desiredIncome,
    availability,
    short_intro: shortIntro,
    work_style: workStyle,
    is_verified: false
  };

  if (photoUrl) {
    insertPayload.photo_url = photoUrl;
  }

  const insertPayloadKeys = Object.keys(insertPayload).sort();
  const expectedPayloadKeys = photoUrl
    ? [...expectedWorkerInsertColumns, "photo_url"].sort()
    : expectedWorkerInsertColumns;

  console.info("Worker registration insert payload comparison.", {
    expectedKeys: expectedPayloadKeys,
    keys: insertPayloadKeys
  });

  const payload = insertPayload;
  console.log("INSERT PAYLOAD:", payload);

  const { data, error } = await supabase
    .from("workers")
    .insert(payload)
    .select("id")
    .single();

  console.log("INSERT RESPONSE:", { data, error });

  if (error) {
    console.log("SUPABASE ERROR FULL:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });

    console.warn("Worker registration insert failed.", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
      payloadKeys: insertPayloadKeys
    });

    return {
      supabaseError: {
        message: error.message,
        details: error.details,
        code: error.code
      }
    };
  }

  if (!data?.id || !isValidEditToken(editToken)) {
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
            Usa un numero de WhatsApp valido con al menos 10 digitos.
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
        <WorkerRegistrationForm
          action={submitWorkerRegistration}
          workStyles={workStyles}
        />
      </main>
    </>
  );
}
