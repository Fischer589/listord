import Link from "next/link";
import { parseWorkerRegistration } from "@/lib/registration-validation";
import { consumeIngestionBudget } from "@/lib/ingestion-budget";
import { revalidatePath } from "next/cache";
import { AppHeader } from "@/components/app-header";
import { WorkerRegistrationForm } from "@/components/worker-registration-form";
import type { WorkStyle } from "@/lib/types";
import {
  findWorkerByWhatsAppNumber,
  uploadWorkerPhoto
} from "@/lib/worker-profile";

export type WorkerRegistrationActionState = {
  success?: true;
  validationError?: true;
  photoWarning?: string;
  jobCategoryError?: true;
  supabaseError?: true;
  existingProfile?: true;
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

async function loadWorkerRegistrationDependencies() {
  try {
    const supabaseAdmin = await import("@/lib/supabase-admin");

    return {
      supabaseAdmin: supabaseAdmin.getSupabaseAdminClient()
    };
  } catch (error) {
    console.error(
      "Worker registration dependencies failed to load.",
      { name: error instanceof Error ? error.name : "UnknownError" }
    );
    return null;
  }
}

async function submitWorkerRegistration(
  _previousState: WorkerRegistrationActionState,
  formData: FormData
): Promise<WorkerRegistrationActionState> {
  "use server";

  const validated = parseWorkerRegistration(formData);
  if (!validated) return { validationError: true };
  if (!await consumeIngestionBudget("registration", validated.whatsapp_number)) return { supabaseError: true };

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

  const existingWorker = await findWorkerByWhatsAppNumber(validated.whatsapp_number);

  if (existingWorker) {
    // Existing profile detected — never insert a duplicate. Surface the
    // existing-profile options instead (Feature 1).
    return {
      existingProfile: true
    };
  }

  const insertPayload = { ...validated, edit_token: crypto.randomUUID() };

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
        name: insertError instanceof Error ? insertError.name : "UnknownError"
      }
    );

    return {
      supabaseError: true
    };
  }

  if (error) {
    if (error.code === "23505") return { existingProfile: true };
    console.error("Worker registration Supabase insert error:", {
      code: error.code
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

  const photoResult = await uploadWorkerPhoto(supabase, formData.get("profile_photo"), data.id);
  const photoUrl = photoResult.url;
  let photoWarning = photoResult.error;

  if (photoUrl) {
    const { error: photoUpdateError } = await supabase
      .from("workers")
      .update({ photo_url: photoUrl })
      .eq("id", data.id);

    if (photoUpdateError) {
      photoWarning = "Recibimos tu perfil, pero no pudimos asociar la foto. Puedes añadirla al editarlo.";
      console.warn("Worker registration photo URL update failed.", {
        code: photoUpdateError.code
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/workers");

  return {
    success: true,
    photoWarning
  };
}

export default async function WorkerRegistrationPage({
  searchParams: searchParamsPromise
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const searchParams = await searchParamsPromise;
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
