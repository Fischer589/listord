import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import type { WorkStyle } from "@/lib/types";

const skills = [
  "Limpieza",
  "Construccion",
  "Pintura",
  "Ventas",
  "Caja",
  "Cocina",
  "Delivery",
  "Jardineria"
];

const workStyles: Array<{ value: WorkStyle; label: string }> = [
  { value: "structured", label: "Trabajo organizado y con reglas claras" },
  { value: "creative", label: "Trabajo creativo" },
  { value: "hands_on", label: "Trabajo fisico / practico" },
  { value: "people_oriented", label: "Trabajo con personas" },
  { value: "systems_oriented", label: "Trabajo de sistemas, procesos o logica" },
  { value: "fast_paced", label: "Trabajo rapido y movido" },
  { value: "detail_oriented", label: "Trabajo detallado" },
  { value: "flexible", label: "Trabajo flexible" }
];

export default function NewWorkerPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/" className="text-sm font-bold text-hoja">
          Volver
        </Link>
        <h1 className="mt-3 text-3xl font-black">Crear perfil de trabajador</h1>
        <p className="mt-2 leading-7 text-black/70">
          Dile al empleador lo que necesita saber para contactarte rapido. La
          confianza se gana cumpliendo.
        </p>

        <form className="mt-5 grid gap-4 rounded-lg border border-black/10 bg-white p-4 shadow-soft">
          <label className="grid gap-1 font-bold">
            Nombre completo
            <input className="tap-target rounded-md border border-black/15 px-3" name="full_name" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 font-bold">
              Ciudad
              <input className="tap-target rounded-md border border-black/15 px-3" name="city" placeholder="Santo Domingo" />
            </label>
            <label className="grid gap-1 font-bold">
              WhatsApp
              <input className="tap-target rounded-md border border-black/15 px-3" name="whatsapp_number" placeholder="809..." />
            </label>
          </div>

          <fieldset className="grid gap-2">
            <legend className="font-bold">Habilidades</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {skills.map((skill) => (
                <label key={skill} className="flex items-center gap-2 rounded-md border border-black/10 p-2 text-sm font-semibold">
                  <input type="checkbox" name="skills" value={skill} className="accent-hoja" />
                  {skill}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 font-bold">
              Cuanto quieres ganar
              <input className="tap-target rounded-md border border-black/15 px-3" name="desired_income" inputMode="numeric" placeholder="1800" />
            </label>
            <label className="grid gap-1 font-bold">
              Tipo
              <select className="tap-target rounded-md border border-black/15 px-3" name="income_type" defaultValue="daily">
                <option value="hourly">Por hora</option>
                <option value="daily">Por dia</option>
                <option value="weekly">Por semana</option>
                <option value="monthly">Al mes</option>
              </select>
            </label>
          </div>

          <label className="grid gap-1 font-bold">
            Disponibilidad
            <input className="tap-target rounded-md border border-black/15 px-3" name="availability" placeholder="Hoy, mananas, fines de semana" />
          </label>
          <label className="flex items-center gap-2 rounded-md border border-black/10 p-3 font-bold">
            <input type="checkbox" name="available_now" className="h-5 w-5 accent-hoja" />
            Estoy disponible hoy
          </label>
          <fieldset className="grid gap-2">
            <legend className="font-bold">
              ¿Que tipo de trabajo te queda mas natural?
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {workStyles.map((style) => (
                <label
                  key={style.value}
                  className="flex items-center gap-2 rounded-md border border-black/10 p-3 text-sm font-semibold"
                >
                  <input
                    type="radio"
                    name="work_style"
                    value={style.value}
                    className="accent-hoja"
                  />
                  {style.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-1 font-bold">
            Cuentanos que tipo de trabajo te hace sentir mas efectivo.
            <textarea
              className="min-h-24 rounded-md border border-black/15 p-3"
              name="work_style_note"
              placeholder="Ejemplo: me gusta moverme, resolver rapido y trabajar con instrucciones claras."
            />
          </label>
          <label className="grid gap-1 font-bold">
            Duracion que prefieres
            <input className="tap-target rounded-md border border-black/15 px-3" name="job_duration_preference" placeholder="Por dia, 1 semana, fijo mensual" />
          </label>
          <label className="grid gap-1 font-bold">
            Presentacion corta
            <textarea className="min-h-28 rounded-md border border-black/15 p-3" name="short_intro" placeholder="Soy puntual, tengo experiencia en..." />
          </label>

          <button className="tap-target rounded-md bg-hoja px-4 py-3 font-black text-white">
            Crear perfil
          </button>
          <p className="text-xs font-semibold text-black/55">
            Nota: conecta Supabase Auth para guardar este formulario en produccion.
          </p>
        </form>
      </main>
    </>
  );
}
