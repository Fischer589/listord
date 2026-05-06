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
  workStyle
}: {
  city?: string;
  skill?: string;
  income?: string;
  workStyle?: string;
}) {
  return (
    <form className="grid gap-3 rounded-2xl border border-hoja/15 bg-card p-3.5 shadow-soft sm:grid-cols-2 sm:p-4 lg:grid-cols-5">
      <label className="grid gap-1.5 text-sm font-bold text-ink">
        Ciudad
        <input
          name="city"
          defaultValue={city}
          placeholder="Santo Domingo"
          className="tap-target rounded-lg border border-hoja/20 px-3 outline-none transition focus:border-hoja focus:ring-2 focus:ring-hoja/15"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-bold text-ink">
        Habilidad
        <input
          name="skill"
          defaultValue={skill}
          placeholder="Limpieza, ventas..."
          className="tap-target rounded-lg border border-hoja/20 px-3 outline-none transition focus:border-hoja focus:ring-2 focus:ring-hoja/15"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-bold text-ink">
        Ingreso máximo
        <input
          name="income"
          inputMode="numeric"
          defaultValue={income}
          placeholder="Hasta RD$2,000"
          className="tap-target rounded-lg border border-hoja/20 px-3 outline-none transition focus:border-hoja focus:ring-2 focus:ring-hoja/15"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-bold text-ink">
        Estilo
        <select
          name="workStyle"
          defaultValue={workStyle ?? ""}
          className="tap-target rounded-lg border border-hoja/20 px-3 outline-none transition focus:border-hoja focus:ring-2 focus:ring-hoja/15"
        >
          <option value="">Cualquier estilo</option>
          {workStyleOptions.map((option) => (
            <option key={option} value={option}>
              {workStyleLabels[option]}
            </option>
          ))}
        </select>
      </label>
      <button className="tap-target rounded-xl bg-hoja px-4 py-2 font-black text-white shadow-soft hover:bg-ink">
        Filtrar
      </button>
    </form>
  );
}
