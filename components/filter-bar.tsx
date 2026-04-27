import { workStyleLabels } from "@/lib/format";
import type { WorkStyle } from "@/lib/types";

const workStyleOptions: WorkStyle[] = [
  "structured",
  "creative",
  "hands_on",
  "people_oriented",
  "systems_oriented",
  "fast_paced",
  "detail_oriented",
  "flexible"
];

export function FilterBar({
  city,
  skill,
  income,
  availableNow,
  workStyle
}: {
  city?: string;
  skill?: string;
  income?: string;
  availableNow?: string;
  workStyle?: string;
}) {
  return (
    <form className="grid gap-3 rounded-lg border border-black/10 bg-white p-3 shadow-soft sm:grid-cols-2 lg:grid-cols-6">
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Ciudad
        <input
          name="city"
          defaultValue={city}
          placeholder="Santo Domingo"
          className="tap-target rounded-md border border-black/15 px-3 outline-none focus:border-hoja"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Habilidad
        <input
          name="skill"
          defaultValue={skill}
          placeholder="Limpieza, ventas..."
          className="tap-target rounded-md border border-black/15 px-3 outline-none focus:border-hoja"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Ingreso máximo
        <input
          name="income"
          inputMode="numeric"
          defaultValue={income}
          placeholder="Hasta RD$2,000"
          className="tap-target rounded-md border border-black/15 px-3 outline-none focus:border-hoja"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Estilo
        <select
          name="workStyle"
          defaultValue={workStyle ?? ""}
          className="tap-target rounded-md border border-black/15 px-3 outline-none focus:border-hoja"
        >
          <option value="">Cualquier estilo</option>
          {workStyleOptions.map((option) => (
            <option key={option} value={option}>
              {workStyleLabels[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-md border border-black/10 px-3 py-3 text-sm font-semibold">
        <input
          type="checkbox"
          name="availableNow"
          value="true"
          defaultChecked={availableNow === "true"}
          className="h-5 w-5 accent-hoja"
        />
        Disponible hoy
      </label>
      <button className="tap-target rounded-md bg-hoja px-4 py-2 font-bold text-white">
        Filtrar
      </button>
    </form>
  );
}
