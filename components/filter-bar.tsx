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
    <form className="filter-form grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5">
      <label className="grid gap-2 text-sm font-black text-ink">
        Ciudad
        <input
          name="city"
          defaultValue={city}
          placeholder="Santo Domingo"
          className="premium-input tap-target"
        />
      </label>
      <label className="grid gap-2 text-sm font-black text-ink">
        Habilidad
        <input
          name="skill"
          defaultValue={skill}
          placeholder="Limpieza, ventas..."
          className="premium-input tap-target"
        />
      </label>
      <label className="grid gap-2 text-sm font-black text-ink">
        Ingreso máximo
        <input
          name="income"
          inputMode="numeric"
          defaultValue={income}
          placeholder="Hasta RD$2,000"
          className="premium-input tap-target"
        />
      </label>
      <label className="grid gap-2 text-sm font-black text-ink">
        Estilo
        <select
          name="workStyle"
          defaultValue={workStyle ?? ""}
          className="premium-input tap-target"
        >
          <option value="">Cualquier estilo</option>
          {workStyleOptions.map((option) => (
            <option key={option} value={option}>
              {workStyleLabels[option]}
            </option>
          ))}
        </select>
      </label>
      <button className="btn-primary tap-target self-end px-4 py-3 text-white">
        Filtrar
      </button>
    </form>
  );
}
