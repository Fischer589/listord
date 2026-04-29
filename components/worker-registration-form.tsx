"use client";

import { useFormState } from "react-dom";
import type { WorkerRegistrationActionState } from "@/app/trabajadores/registro/page";
import type { workStyles } from "@/lib/worker-profile";

type WorkerRegistrationFormProps = {
  action: (
    previousState: WorkerRegistrationActionState,
    formData: FormData
  ) => Promise<WorkerRegistrationActionState>;
  workStyles: typeof workStyles;
};

const initialState: WorkerRegistrationActionState = {};

export function WorkerRegistrationForm({
  action,
  workStyles
}: WorkerRegistrationFormProps) {
  const [state, formAction] = useFormState(action, initialState);
  const supabaseError = state.supabaseError;

  return (
    <>
      {supabaseError && (
        <div className="mt-5 rounded-lg border-2 border-red-700 bg-red-50 p-6 text-red-950 shadow-soft">
          <p className="text-xl font-black">SUPABASE INSERT ERROR</p>
          <div className="mt-4 grid gap-3 break-all font-mono text-sm font-bold">
            <p>
              <span className="font-black">message: </span>
              {supabaseError.message}
            </p>
            {supabaseError.details && (
              <p>
                <span className="font-black">details: </span>
                {supabaseError.details}
              </p>
            )}
            <p>
              <span className="font-black">code: </span>
              {supabaseError.code}
            </p>
          </div>
        </div>
      )}

      <form
        action={formAction}
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
              placeholder="8091234567 o +12675160983"
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

        <button className="tap-target rounded-md bg-hoja px-4 py-3 font-black text-white">
          Enviar registro
        </button>
        <p className="text-xs font-semibold text-black/55">
          Tu perfil se guarda como pendiente y no aparece publicamente hasta
          que sea aprobado.
        </p>
      </form>
    </>
  );
}
