"use client";

import { WorkerPhotoInput } from "@/components/worker-photo-input";
import { useActionState } from "react";
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
  const [state, formAction] = useActionState(action, initialState);
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
            Revisaremos tu perfil. Para confirmar tu disponibilidad o elegir
            avisos por WhatsApp, primero deberás verificar su titularidad.
          </p>
        </div>
      )}

      {state.photoWarning && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-900">{state.photoWarning}</p>}

      {state.validationError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-900">Revisa el nombre, la ciudad, el trabajo y el teléfono. Usa datos válidos y textos breves.</p>}

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
                Opcional — muestra tu trabajo
              </span>
            </span>
            <WorkerPhotoInput className="w-full min-w-0 rounded-xl border border-black/15 bg-white px-3 py-2 text-xs font-semibold sm:text-sm" />
          </label>
          <p className="mt-1.5 text-xs font-semibold text-ink/55">
            PNG, JPG o WEBP · Máximo 4 MB · Foto clara de tu cara o de tu
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
