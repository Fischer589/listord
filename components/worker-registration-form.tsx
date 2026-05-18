"use client";

import { useFormState } from "react-dom";
import type React from "react";
import type { WorkerRegistrationActionState } from "@/app/trabajadores/registro/page";
import type { WorkStyle } from "@/lib/types";

type WorkStyleOption = {
  value: WorkStyle;
  label: string;
};

type WorkerRegistrationFormProps = {
  action: (
    previousState: WorkerRegistrationActionState,
    formData: FormData
  ) => Promise<WorkerRegistrationActionState>;
  workStyles: WorkStyleOption[];
};

const initialState: WorkerRegistrationActionState = {};
const shareText = encodeURIComponent(
  "Mira mi perfil en ListoRD 👇\nhttps://listordapp.com\nEstoy registrado en ListoRD para recibir oportunidades de trabajo."
);
const jobCategoryError = "Escribe claramente qué trabajo haces.";

function setRequiredJobCategoryMessage(
  event: React.InvalidEvent<HTMLInputElement>
) {
  event.currentTarget.setCustomValidity(jobCategoryError);
}

function clearCustomValidity(event: React.FormEvent<HTMLInputElement>) {
  event.currentTarget.setCustomValidity("");
}

export function WorkerRegistrationForm({
  action,
  workStyles
}: WorkerRegistrationFormProps) {
  const [state, formAction] = useFormState(action, initialState);
  const success = state.success;
  const hasJobCategoryError = state.jobCategoryError;
  const supabaseError = state.supabaseError;

  return (
    <>
      {success && (
        <div className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-soft">
          <p className="text-2xl font-black text-green-900">
            ¡Listo! Recibimos tu perfil. 🎉
          </p>
          <p className="mt-2 font-semibold leading-7 text-green-800">
            Lo revisamos y te avisaremos por WhatsApp cuando estés visible en
            ListoRD.
          </p>
          <div className="mt-5 rounded-xl border border-green-200 bg-white p-4">
            <p className="font-black text-green-900">
              Comparte tu perfil para que más personas te vean.
            </p>
            <p className="mt-1 text-sm font-semibold text-green-700">
              Cuantas más personas vean tu perfil, más rápido consigues clientes.
            </p>
            <a
              href={`https://wa.me/?text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tap-target mt-4 inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-[#1f7a4c] px-4 py-3 text-center font-black text-white sm:w-fit"
            >
              <WhatsAppShareIcon />
              Compartir mi perfil por WhatsApp
            </a>
          </div>
        </div>
      )}

      {supabaseError && (
        <div className="mt-5 min-w-0 break-words rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
          No pudimos enviar tu registro ahora mismo. Intenta otra vez en unos
          minutos.
        </div>
      )}

      {hasJobCategoryError && (
        <div className="mt-5 min-w-0 break-words rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
          {jobCategoryError}
        </div>
      )}

      <form
        action={formAction}
        encType="multipart/form-data"
        className="worker-registration-form mt-5 grid w-full min-w-0 gap-5 overflow-hidden rounded-2xl border border-black/10 bg-white p-5 shadow-soft"
      >
        {/* Name */}
        <label className="grid min-w-0 gap-1.5 font-black text-ink">
          Nombre completo
          <input
            className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
            name="full_name"
            placeholder="Tu nombre como quieres aparecer"
            required
          />
        </label>

        {/* Photo — strongly encouraged */}
        <div className="min-w-0 rounded-xl border border-dashed border-hoja/40 bg-cielo/50 p-4">
          <label className="grid min-w-0 gap-1.5 font-black text-ink">
            <span className="flex min-w-0 flex-wrap items-baseline gap-2">
              Foto de perfil
              <span className="rounded-full bg-hoja/15 px-2 py-0.5 text-xs font-black text-hoja">
                Recomendado — sube 3× más clientes
              </span>
            </span>
            <input
              className="w-full min-w-0 rounded-xl border border-black/15 bg-white px-3 py-2 text-xs font-semibold sm:text-sm"
              name="profile_photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
            />
          </label>
          <p className="mt-1.5 text-xs font-semibold text-ink/55">
            PNG, JPG o WEBP · Máximo 5 MB · Foto clara de tu cara o de tu
            trabajo
          </p>
        </div>

        {/* City + WhatsApp */}
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1.5 font-black text-ink">
            Ciudad
            <input
              className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
              name="city"
              placeholder="Santo Domingo, Santiago..."
              required
            />
          </label>
          <label className="grid min-w-0 gap-1.5 font-black text-ink">
            Número de WhatsApp
            <input
              className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
              name="whatsapp_number"
              inputMode="tel"
              autoComplete="tel"
              placeholder="8091234567 o +12675160983"
              required
            />
          </label>
        </div>

        {/* Primary job */}
        <label className="grid min-w-0 gap-1.5 font-black text-ink">
          ¿Qué trabajo haces principalmente?
          <input
            className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
            name="job_category"
            placeholder="Ejemplo: limpiadora, cocinera, construcción, plomero..."
            required
            onInvalid={setRequiredJobCategoryMessage}
            onInput={clearCustomValidity}
          />
        </label>

        {/* Other skills */}
        <label className="grid min-w-0 gap-1.5 font-black text-ink">
          Otras habilidades{" "}
          <span className="font-semibold text-black/55">(opcional)</span>
          <textarea
            className="min-h-20 w-full min-w-0 rounded-xl border border-black/15 p-4 text-base"
            name="skills"
            placeholder="Limpieza, cocina, construcción, cuidado de niños..."
          />
        </label>

        {/* Income */}
        <div className="grid min-w-0 gap-1.5">
          <label className="font-black text-ink" htmlFor="desired_income">
            Tarifa por día (en RD$)
          </label>
          <input
            id="desired_income"
            className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
            name="desired_income"
            inputMode="numeric"
            placeholder="Ej: 1800"
            required
          />
          <p className="text-xs font-semibold text-ink/50">
            El promedio en RD es entre RD$800 y RD$3,000 por día según el
            trabajo
          </p>
        </div>

        {/* Availability */}
        <label className="grid min-w-0 gap-1.5 font-black text-ink">
          Disponibilidad
          <textarea
            className="min-h-20 w-full min-w-0 rounded-xl border border-black/15 p-4 text-base"
            name="availability"
            placeholder="Ej: Disponible de lunes a viernes, también fines de semana"
            required
          />
        </label>

        {/* Short intro */}
        <label className="grid min-w-0 gap-1.5 font-black text-ink">
          Descripción corta
          <textarea
            className="min-h-28 w-full min-w-0 rounded-xl border border-black/15 p-4 text-base"
            name="short_intro"
            placeholder="Ej: Soy puntual y tengo 5 años de experiencia en limpieza de hogares. Trabajo con materiales propios y dejo todo perfecto."
            minLength={20}
            required
          />
          <span className="text-xs font-semibold text-ink/50">
            Mínimo 20 caracteres — cuéntanos por qué eres la mejor opción
          </span>
        </label>

        {/* Work style */}
        <label className="grid min-w-0 gap-1.5 font-black text-ink">
          Estilo de trabajo
          <select
            className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
            name="work_style"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Selecciona el que más te describe
            </option>
            {workStyles.map((style) => (
              <option key={style.value} value={style.value}>
                {style.label}
              </option>
            ))}
          </select>
        </label>

        <button className="tap-target w-full min-w-0 rounded-2xl bg-gradient-to-br from-ink to-[#2d4a1e] px-4 py-4 text-lg font-black text-white shadow-[0_16px_40px_rgba(29,29,27,0.22)] hover:shadow-[0_20px_50px_rgba(29,29,27,0.28)]">
          Crear mi perfil gratis →
        </button>
        <p className="min-w-0 break-words text-center text-xs font-semibold text-black/50">
          Tu perfil se revisa manualmente y aparece públicamente una vez
          aprobado — generalmente en menos de 24 horas.
        </p>
      </form>
    </>
  );
}

function WhatsAppShareIcon() {
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
