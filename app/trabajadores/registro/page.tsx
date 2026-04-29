import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { WorkerRegistrationForm } from "@/components/worker-registration-form";
import type { WorkStyle } from "@/lib/types";

export type WorkerRegistrationActionState = {
  success?: true;
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

async function loadWorkerRegistrationDependencies() {
  try {
    const supabaseAdmin = await import("@/lib/supabase-admin");

    return {
      getSupabaseAdminClient: supabaseAdmin.getSupabaseAdminClient
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

  const dependencies = await loadWorkerRegistrationDependencies();

  if (!dependencies) {
    return {
      supabaseError: true
    };
  }

  let supabase: ReturnType<typeof dependencies.getSupabaseAdminClient>;

  try {
    supabase = dependencies.getSupabaseAdminClient();
  } catch (error) {
    console.error(
      "Worker registration Supabase admin client failed to initialize.",
      getServerErrorDetails(error)
    );
    return {
      supabaseError: true
    };
  }

  if (!supabase) {
    console.warn("Worker registration skipped: Supabase admin client unavailable.");
    return {
      supabaseError: true
    };
  }

  const insertPayload: {
    availability: string[];
    city: string;
    desired_income: number;
    edit_token: string;
    full_name: string;
    is_verified: false;
    short_intro: string;
    skills: string[];
    whatsapp_number: string;
    work_style: "flexible";
  } = {
    full_name: String(formData.get("full_name") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    whatsapp_number: String(formData.get("whatsapp_number") || "").trim(),
    work_style: "flexible",
    edit_token: crypto.randomUUID(),
    skills: [],
    availability: [],
    desired_income: 0,
    short_intro: "",
    is_verified: false
  };

  const insertPayloadKeys = Object.keys(insertPayload).sort();

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
      getServerErrorDetails(insertError)
    );

    return {
      supabaseError: true
    };
  }

  if (error) {
    console.error("SUPABASE ERROR FULL:", {
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
        {state === "error" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
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
