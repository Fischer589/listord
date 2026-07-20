import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { EmployerRequestForm } from "@/components/employer-request-form";
import {
  CLIENT_TYPES,
  EMPLOYER_CATEGORY_OPTIONS,
  EMPLOYMENT_TYPES,
  OTRO_CATEGORY_VALUE,
  isKnownCategoryValue
} from "@/lib/employer-requests";
import { getText } from "@/lib/worker-profile";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

export type EmployerRequestActionState = {
  success?: true;
  error?: string;
};

function getServerErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }
  return { message: String(error), name: "UnknownError" };
}

async function loadEmployerRequestDependencies() {
  try {
    const supabaseAdmin = await import("@/lib/supabase-admin");
    return { supabaseAdmin: supabaseAdmin.supabaseAdmin };
  } catch (error) {
    console.error(
      "Employer request dependencies failed to load.",
      getServerErrorDetails(error)
    );
    return null;
  }
}

const GENERIC_ERROR =
  "No pudimos enviar tu solicitud ahora mismo. Intenta de nuevo en unos minutos.";

async function submitEmployerRequest(
  _previousState: EmployerRequestActionState,
  formData: FormData
): Promise<EmployerRequestActionState> {
  "use server";

  const dependencies = await loadEmployerRequestDependencies();

  if (!dependencies?.supabaseAdmin) {
    console.warn("Employer request submission skipped: Supabase admin client unavailable.");
    return { error: GENERIC_ERROR };
  }

  const supabase = dependencies.supabaseAdmin;

  const name = getText(formData, "name");
  const clientType = getText(formData, "client_type");
  const categorySelect = getText(formData, "service_needed_select");
  const categoryOther = getText(formData, "service_needed_other");
  const city = getText(formData, "city");
  const zone = getText(formData, "zone");
  const description = getText(formData, "description");
  const employmentType = getText(formData, "employment_type");
  const budget = getText(formData, "budget");
  const whatsappInput = getText(formData, "whatsapp");
  const email = getText(formData, "email");

  const isOtro = categorySelect === OTRO_CATEGORY_VALUE;
  const serviceNeeded = isOtro ? categoryOther : categorySelect;
  const categorySource: "catalog" | "otro" =
    !isOtro && isKnownCategoryValue(categorySelect) ? "catalog" : "otro";

  const normalizedWhatsApp = normalizeWhatsAppNumber(whatsappInput);

  if (
    name.length < 2 ||
    !clientType ||
    !serviceNeeded ||
    !city ||
    description.length < 10 ||
    !employmentType
  ) {
    return { error: "Completa todos los campos requeridos con al menos unos detalles básicos." };
  }

  if (!normalizedWhatsApp) {
    return { error: "Usa un número de WhatsApp válido con al menos 10 dígitos." };
  }

  const location = zone ? `${city}, ${zone}` : city;

  try {
    const { error } = await supabase.from("employer_requests").insert({
      name,
      client_type: clientType,
      service_needed: serviceNeeded,
      category_source: categorySource,
      location,
      description,
      employment_type: employmentType,
      budget: budget || null,
      whatsapp: normalizedWhatsApp,
      email: email || null,
      status: "new"
    });

    if (error) {
      console.error("Employer request insert failed.", {
        code: error.code,
        message: error.message
      });
      return { error: GENERIC_ERROR };
    }

    return { success: true };
  } catch (insertError) {
    console.error(
      "Employer request insert threw unexpectedly.",
      getServerErrorDetails(insertError)
    );
    return { error: GENERIC_ERROR };
  }
}

export default function EmployeeRequestFormPage() {
  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <section className="container max-w-2xl py-8">
          <Link href="/" className="text-sm font-bold text-hoja">
            ← Volver al inicio
          </Link>

          <div className="mt-4 rounded-2xl border border-hoja/20 bg-cielo/50 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-hoja">
              Para empresas y personas que necesitan personal
            </p>
            <h1 className="mt-2 text-3xl font-black text-ink">Solicita personal</h1>
            <p className="mt-2 leading-7 text-ink/70">
              Cuéntanos qué tipo de trabajador necesitas y te ayudaremos a encontrar
              personas disponibles.
            </p>
          </div>

          <EmployerRequestForm
            action={submitEmployerRequest}
            clientTypes={CLIENT_TYPES}
            categoryOptions={EMPLOYER_CATEGORY_OPTIONS}
            otroValue={OTRO_CATEGORY_VALUE}
            employmentTypes={EMPLOYMENT_TYPES}
          />
        </section>
      </main>
    </>
  );
}
