"use client";

import { useFormState } from "react-dom";
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

export function WorkerRegistrationForm({
  action,
  workStyles
}: WorkerRegistrationFormProps) {
  const [state, formAction] = useFormState(action, initialState);
  const success = state.success;
  const supabaseError = state.supabaseError;

  return (
    <>
      {success && (
        <div className="mt-5 grid min-w-0 gap-3 break-words rounded-lg border border-green-200 bg-green-50 p-4 font-bold text-green-900">
          <p>Registro exitoso</p>
          <p className="font-semibold">
            Comparte tu perfil para que más personas te vean.
          </p>
          <a
            href={`https://wa.me/?text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-target inline-flex w-full min-w-0 items-center justify-center rounded-md bg-ink px-4 py-3 text-center font-black text-white sm:w-fit"
          >
            Compartir mi perfil
          </a>
        </div>
      )}

      {supabaseError && (
        <div className="mt-5 min-w-0 break-words rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
          No pudimos enviar tu registro ahora mismo. Intenta otra vez en unos
          minutos.
        </div>
      )}

      <form
        action={formAction}
        encType="multipart/form-data"
        className="worker-registration-form mt-5 grid w-full min-w-0 gap-4 overflow-hidden rounded-lg border border-black/10 bg-white p-4 shadow-soft"
      >
        <label className="grid min-w-0 gap-1 font-bold">
          Nombre completo
          <input
            className="tap-target w-full min-w-0 rounded-md border border-black/15 px-3"
            name="full_name"
            required
          />
        </label>

        <label className="grid min-w-0 gap-1 font-bold">
          <span className="min-w-0 break-words">
            Foto de perfil{" "}
            <span className="font-semibold text-black/55">(opcional)</span>
          </span>
          <input
            className="w-full min-w-0 rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-semibold sm:text-sm"
            name="profile_photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
          />
          <span className="min-w-0 break-words text-xs font-semibold text-black/55">
            PNG, JPG o WEBP. Maximo 5 MB.
          </span>
        </label>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1 font-bold">
            Ciudad
            <input
              className="tap-target w-full min-w-0 rounded-md border border-black/15 px-3"
              name="city"
              placeholder="Santo Domingo"
              required
            />
          </label>
          <label className="grid min-w-0 gap-1 font-bold">
            Numero de WhatsApp
            <input
              className="tap-target w-full min-w-0 rounded-md border border-black/15 px-3"
              name="whatsapp_number"
              inputMode="tel"
              autoComplete="tel"
              placeholder="8091234567 o +12675160983"
              required
            />
          </label>
        </div>

        <label className="grid min-w-0 gap-1 font-bold">
          Habilidades
          <textarea
            className="min-h-24 w-full min-w-0 rounded-md border border-black/15 p-3"
            name="skills"
            placeholder="Limpieza, cocina, construccion"
            required
          />
        </label>

        <label className="grid min-w-0 gap-1 font-bold">
          Ingreso deseado por dia
          <input
            className="tap-target w-full min-w-0 rounded-md border border-black/15 px-3"
            name="desired_income"
            inputMode="numeric"
            placeholder="1800"
            required
          />
        </label>

        <label className="grid min-w-0 gap-1 font-bold">
          Disponibilidad
          <textarea
            className="min-h-24 w-full min-w-0 rounded-md border border-black/15 p-3"
            name="availability"
            placeholder="Hoy, mananas, fines de semana"
            required
          />
        </label>

        <label className="grid min-w-0 gap-1 font-bold">
          Descripcion corta
          <textarea
            className="min-h-28 w-full min-w-0 rounded-md border border-black/15 p-3"
            name="short_intro"
            placeholder="Soy puntual, tengo experiencia en..."
            minLength={20}
            required
          />
        </label>

        <label className="grid min-w-0 gap-1 font-bold">
          Estilo de trabajo
          <select
            className="tap-target w-full min-w-0 rounded-md border border-black/15 px-3"
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

        <button className="tap-target w-full min-w-0 rounded-md bg-hoja px-4 py-3 font-black text-white">
          Enviar registro
        </button>
        <p className="min-w-0 break-words text-xs font-semibold text-black/55">
          Tu perfil se guarda como pendiente y no aparece publicamente hasta
          que sea aprobado.
        </p>
      </form>
    </>
  );
}
