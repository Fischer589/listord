"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { EmployerRequestActionState } from "@/app/employee-request-form/page";

type EmployerRequestFormProps = {
  action: (
    previousState: EmployerRequestActionState,
    formData: FormData
  ) => Promise<EmployerRequestActionState>;
  clientTypes: string[];
  categoryOptions: Array<{ value: string; label: string }>;
  otroValue: string;
  employmentTypes: string[];
};

const initialState: EmployerRequestActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="tap-target w-full min-w-0 rounded-2xl bg-gradient-to-br from-ink to-[#2d4a1e] px-4 py-4 text-lg font-black text-white shadow-[0_16px_40px_rgba(29,29,27,0.22)] hover:shadow-[0_20px_50px_rgba(29,29,27,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Enviando..." : "Enviar solicitud"}
    </button>
  );
}

export function EmployerRequestForm({
  action,
  clientTypes,
  categoryOptions,
  otroValue,
  employmentTypes
}: EmployerRequestFormProps) {
  const [state, formAction] = useFormState(action, initialState);
  const [selectedCategory, setSelectedCategory] = useState("");

  if (state.success) {
    return (
      <div className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-soft">
        <p className="text-2xl font-black text-green-900">
          ¡Solicitud recibida! 🎉
        </p>
        <p className="mt-2 font-semibold leading-7 text-green-800">
          Revisaremos tu solicitud y te contactaremos por WhatsApp para ayudarte a
          encontrar a la persona indicada.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-5 grid w-full min-w-0 gap-5 overflow-hidden rounded-2xl border border-black/10 bg-white p-5 shadow-soft"
    >
      {state.error && (
        <div className="min-w-0 break-words rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
          {state.error}
        </div>
      )}

      {/* 1. Nombre del solicitante */}
      <label className="grid min-w-0 gap-1.5 font-black text-ink">
        Nombre del solicitante
        <input
          className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
          name="name"
          placeholder="Tu nombre"
          required
        />
      </label>

      {/* 2. Tipo de cliente */}
      <label className="grid min-w-0 gap-1.5 font-black text-ink">
        Tipo de cliente
        <select
          className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
          name="client_type"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          {clientTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {/* 3. ¿Qué tipo de trabajador necesitas? — reuses the exact worker
          category values (lib/categories.ts searchKey) so future matching
          works against worker profiles without a second taxonomy. */}
      <div className="grid min-w-0 gap-1.5">
        <label className="font-black text-ink" htmlFor="service_needed_select">
          ¿Qué tipo de trabajador necesitas?
        </label>
        <select
          id="service_needed_select"
          className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
          name="service_needed_select"
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
          required
        >
          <option value="" disabled>
            Busca o selecciona una categoría
          </option>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value={otroValue}>Otro</option>
        </select>

        {selectedCategory === otroValue && (
          <input
            className="tap-target mt-1.5 w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
            name="service_needed_other"
            placeholder="Describe el tipo de trabajador que necesitas"
            required
          />
        )}
      </div>

      {/* 4. Ubicación */}
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
          Zona{" "}
          <span className="font-semibold text-black/55">(opcional)</span>
          <input
            className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
            name="zone"
            placeholder="Piantini, Bella Vista..."
          />
        </label>
      </div>

      {/* 5. Descripción del trabajo */}
      <label className="grid min-w-0 gap-1.5 font-black text-ink">
        Descripción del trabajo
        <textarea
          className="min-h-28 w-full min-w-0 rounded-xl border border-black/15 p-4 text-base"
          name="description"
          placeholder="Ej: Necesito una persona para limpieza de apartamento 3 veces por semana."
          minLength={10}
          required
        />
      </label>

      {/* 6. Tipo de contratación */}
      <label className="grid min-w-0 gap-1.5 font-black text-ink">
        Tipo de contratación
        <select
          className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
          name="employment_type"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          {employmentTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {/* 7. Presupuesto aproximado */}
      <label className="grid min-w-0 gap-1.5 font-black text-ink">
        Presupuesto aproximado{" "}
        <span className="font-semibold text-black/55">(opcional)</span>
        <input
          className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
          name="budget"
          placeholder="Ej: RD$1,500 por día"
        />
      </label>

      {/* 8. WhatsApp */}
      <label className="grid min-w-0 gap-1.5 font-black text-ink">
        WhatsApp
        <input
          className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
          name="whatsapp"
          inputMode="tel"
          autoComplete="tel"
          placeholder="8091234567 o +12675160983"
          required
        />
      </label>

      {/* 9. Email */}
      <label className="grid min-w-0 gap-1.5 font-black text-ink">
        Email{" "}
        <span className="font-semibold text-black/55">(opcional)</span>
        <input
          className="tap-target w-full min-w-0 rounded-xl border border-black/15 px-4 text-base"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
        />
      </label>

      <SubmitButton />
    </form>
  );
}
