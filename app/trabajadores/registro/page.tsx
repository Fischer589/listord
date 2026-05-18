import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppHeader } from "@/components/app-header";
import { WorkerRegistrationForm } from "@/components/worker-registration-form";
import type { WorkStyle } from "@/lib/types";
import {
  getList,
  normalizeWhatsAppNumber,
  uploadWorkerPhoto
} from "@/lib/worker-profile";

export type WorkerRegistrationActionState = {
  success?: true;
  jobCategoryError?: true;
  supabaseError?: true;
};

const fallbackWorkStyles: Array<{ value: WorkStyle; label: string }> = [
  { label: "Estructurado", value: "structured" },
  { label: "Creativo", value: "creative" },
  { label: "Manual / práctico", value: "hands_on" },
  { label: "Trato con personas", value: "people_oriented" },
  { label: "Sistemas / técnico", value: "systems_oriented" },
  { label: "Rápido / dinámico", value: "fast_paced" },
  { label: "Detallista", value: "detail_oriented" },
  { label: "Flexible", value: "flexible" }
];

function getServerErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack
    };
  }

  return {
    message: String(error),
    name: "UnknownError"
  };
}

function logWorkerRegistrationServerConfig() {
  console.info("Worker registration server config:", {
    hasNextPublicSupabaseUrl: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    ),
    hasSupabaseServiceRoleKey: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    )
  });
}

function getDesiredIncome(formData: FormData) {
  const desiredIncome = Number(formData.get("desired_income"));

  return Number.isFinite(desiredIncome) ? desiredIncome : 0;
}

function getShortIntro(formData: FormData) {
  const shortIntro = String(formData.get("short_intro") || "").trim();

  return shortIntro || "Disponible para trabajar.";
}

function getWorkerSkillsWithPrimaryJob(formData: FormData) {
  const primaryJob = String(formData.get("job_category") || "").trim();

  if (!primaryJob) {
    return null;
  }

  const extraSkills = getList(formData, "skills").filter(
    (skill) => skill.toLowerCase() !== primaryJob.toLowerCase()
  );

  return [primaryJob, ...extraSkills];
}

async function loadWorkerRegistrationDependencies() {
  try {
    const supabaseAdmin = await import("@/lib/supabase-admin");

    return {
      supabaseAdmin: supabaseAdmin.supabaseAdmin
    };
  } catch (error) {
    console.error(
      "Worker registration dependencies failed to load.",
      getServerErrorDetails(error)
    );
    return null;
  }
}

async function submitWorkerRegistration(
  _previousState: WorkerRegistrationActionState,
  formData: FormData
): Promise<WorkerRegistrationActionState> {
  "use server";

  logWorkerRegistrationServerConfig();

  const dependencies = await loadWorkerRegistrationDependencies();

  if (!dependencies) {
    return {
      supabaseError: true
    };
  }

  const supabase = dependencies.supabaseAdmin;

  if (!supabase) {
    console.warn("Worker registration skipped: Supabase admin client unavailable.");
    return {
      supabaseError: true
    };
  }

  const skills = getWorkerSkillsWithPrimaryJob(formData);

  if (!skills) {
    return {
      jobCategoryError: true
    };
  }

  const insertPayload: {
    city: string;
    desired_income: number;
    edit_token: string;
    full_name: string;
    short_intro: string;
    skills: string[];
    whatsapp_number: string;
    work_style: WorkStyle;
  } = {
    full_name: String(formData.get("full_name") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    whatsapp_number: String(formData.get("whatsapp_number") || "").trim(),
    work_style: String(formData.get("work_style") || "flexible") as WorkStyle,
    short_intro: getShortIntro(formData),
    skills,
    desired_income: getDesiredIncome(formData),
    edit_token: crypto.randomUUID()
  };

  const insertPayloadKeys = Object.keys(insertPayload).sort();

  console.info("Worker registration insert payload keys:", insertPayloadKeys);

  let data: { id: string } | null = null;
  let error:
    | {
        message: string;
        code?: string;
        details?: string | null;
        hint?: string | null;
      }
    | null = null;

  try {
    const response = await supabase
      .from("workers")
      .insert(insertPayload)
      .select("id")
      .single();

    data = response.data;
    error = response.error;
  } catch (insertError) {
    console.error(
      "Worker registration insert threw before Supabase returned a response.",
      {
        ...getServerErrorDetails(insertError),
        payloadKeys: insertPayloadKeys
      }
    );

    return {
      supabaseError: true
    };
  }

  if (error) {
    console.error("Worker registration Supabase insert error:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      payloadKeys: insertPayloadKeys
    });

    return {
      supabaseError: true
    };
  }

  if (!data?.id) {
    console.warn("Worker registration insert returned no worker id.");
    return {
      supabaseError: true
    };
  }

  const normalizedWhatsAppNumber =
    normalizeWhatsAppNumber(insertPayload.whatsapp_number) ||
    insertPayload.whatsapp_number.replace(/\D/g, "") ||
    data.id;
  const photoUrl = await uploadWorkerPhoto(
    supabase,
    formData.get("profile_photo"),
    normalizedWhatsAppNumber
  );

  if (photoUrl) {
    const { error: photoUpdateError } = await supabase
      .from("workers")
      .update({ photo_url: photoUrl })
      .eq("id", data.id);

    if (photoUpdateError) {
      console.warn("Worker registration photo URL update failed.", {
        workerId: data.id,
        code: photoUpdateError.code,
        message: photoUpdateError.message
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/workers");

  return {
    success: true
  };
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
      <main className="worker-registration-page mx-auto w-full min-w-0 max-w-3xl overflow-x-hidden px-4 py-6">
        <Link href="/" className="text-sm font-bold text-hoja">
          ← Volver al inicio
        </Link>

        <div className="mt-4 rounded-2xl border border-hoja/20 bg-cielo/50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-hoja">
            Gratis · Sin comisiones
          </p>
          <h1 className="mt-2 break-words text-3xl font-black text-ink">
            Crea tu perfil gratis y consigue clientes por WhatsApp
          </h1>
          <p className="mt-2 break-words leading-7 text-ink/70">
            Hazte visible en tu ciudad. Los clientes te encuentran en ListoRD y
            te contactan directo por WhatsApp — sin intermediarios.
          </p>
        </div>

        {state === "incompleto" && (
          <div className="mt-5 min-w-0 break-words rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Completa el nombre, la descripción y todos los campos requeridos
            para enviar tu registro.
          </div>
        )}
        {state === "telefono" && (
          <div className="mt-5 min-w-0 break-words rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Usa un número de WhatsApp válido con al menos 10 dígitos.
          </div>
        )}
        {state === "duplicado" && (
          <div className="mt-5 min-w-0 break-words rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Ese WhatsApp ya fue registrado. No se puede enviar el mismo perfil
            dos veces.
          </div>
        )}
        {state === "rechazado" && (
          <div className="mt-5 min-w-0 break-words rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Revisa el texto del perfil. No aceptamos lenguaje ofensivo o spam.
          </div>
        )}
        {state === "error" && (
          <div className="mt-5 min-w-0 break-words rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            No pudimos enviar tu registro ahora mismo. Intenta otra vez en unos
            minutos.
          </div>
        )}
        <WorkerRegistrationForm
          action={submitWorkerRegistration}
          workStyles={fallbackWorkStyles}
        />
      </main>
    </>
  );
}
