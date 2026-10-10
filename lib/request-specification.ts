import { CATEGORIES } from "./categories";

export type Question = { id: string; label: string; options?: readonly string[]; optional?: boolean };
const choice = (id: string, label: string, options: string[]): Question => ({ id, label, options });
const detail = (id: string, label: string, optional = false): Question => ({ id, label, optional });

/** Shared, versioned engine. Keys are the existing category search keys. */
export const REQUEST_SCHEMAS: Record<string, readonly Question[]> = {
  limpieza: [choice("property", "¿Qué espacio necesitas limpiar?", ["Casa", "Apartamento", "Oficina", "Local"]), detail("tasks", "Tareas y tamaño aproximado del espacio"), choice("supplies", "Productos y utensilios", ["Los pongo yo", "Debe traerlos la persona", "Por acordar"])],
  cocina: [choice("setting", "¿Dónde se cocinará?", ["Hogar", "Restaurante", "Evento"]), detail("meals", "Comidas, cantidad de personas y necesidades alimentarias"), choice("supplies", "Ingredientes y equipo", ["Los pongo yo", "Debe traerlos la persona", "Por acordar"])],
  plomeria: [detail("problem", "Problema y pieza afectada"), choice("urgency", "Urgencia", ["Lo antes posible", "Puede programarse"]), choice("materials", "Materiales", ["Ya los tengo", "Necesito orientación", "Debe traerlos la persona"])],
  electricidad: [detail("task", "Falla o instalación y cantidad de puntos"), choice("urgency", "Urgencia", ["Lo antes posible", "Puede programarse"]), choice("materials", "Materiales", ["Ya los tengo", "Necesito orientación", "Debe traerlos la persona"])],
  construccion: [detail("trade", "Oficio y tarea concreta"), choice("stage", "Etapa del proyecto", ["Obra nueva", "Remodelación", "Reparación"]), detail("crew", "Cantidad de personas y herramientas necesarias")],
  pintura: [choice("place", "Área de trabajo", ["Interior", "Exterior", "Ambos"]), detail("surface", "Superficie, tamaño aproximado y preparación necesaria"), choice("paint", "Pintura y herramientas", ["Las pongo yo", "Debe traerlas la persona", "Por acordar"])],
  clases: [detail("subject", "Materia y nivel"), choice("format", "Modalidad", ["Presencial", "En línea"]), detail("learners", "Cantidad de alumnos y frecuencia")],
  belleza: [detail("service", "Servicio y cantidad de personas"), choice("place", "Lugar", ["A domicilio", "En un salón", "En un evento"]), choice("supplies", "Productos y equipo", ["Los pongo yo", "Debe traerlos la persona", "Por acordar"])],
  jardineria: [detail("tasks", "Tareas y tamaño aproximado del jardín"), choice("tools", "Herramientas", ["Las pongo yo", "Debe traerlas la persona", "Por acordar"]), choice("waste", "Retiro de residuos", ["Se necesita", "No se necesita", "Por acordar"])],
  conductor: [detail("route", "Zona de salida y destino (sin direcciones exactas)"), detail("load", "Pasajeros o tipo y tamaño de la carga"), choice("vehicle", "Vehículo", ["Lo pongo yo", "Debe traerlo la persona", "Por acordar"])],
  ninos: [detail("ages", "Cantidad de niños y rangos de edad (sin nombres)"), detail("tasks", "Tareas de cuidado y apoyo necesarias"), choice("presence", "¿Habrá otro adulto presente?", ["Sí", "No", "Por acordar"])],
  cuidadora: [detail("support", "Asistencia necesaria (sin información médica privada)"), choice("mobility", "Apoyo para desplazarse", ["No se necesita", "Apoyo parcial", "Apoyo continuo", "Por acordar"]), detail("tasks", "Tareas incluidas")],
  carpinteria: [detail("item", "Trabajo y mueble o pieza"), detail("size", "Medidas aproximadas o indicar que se necesita medir"), choice("materials", "Materiales y herramientas", ["Los pongo yo", "Debe traerlos la persona", "Necesito orientación"])],
  seguridad: [choice("site", "Lugar", ["Residencia", "Comercio", "Evento"]), detail("tasks", "Funciones y cantidad de personas necesarias"), detail("equipment", "Equipo necesario y quién lo proporciona")],
};

export const COMPENSATION_UNITS = ["por trabajo", "por hora", "por día", "por semana", "por mes"] as const;
export type RequestDraft = {
  schemaVersion: 1; category: string; city: string; answers: Record<string, string>;
  timing: string; duration: string; compensation: "fixed" | "budget" | "negotiable";
  amount: string; unit: string; exclusions: string; requirements: string;
};
export function emptyRequest(): RequestDraft {
  return { schemaVersion: 1, category: "", city: "", answers: {}, timing: "", duration: "", compensation: "budget", amount: "", unit: "por trabajo", exclusions: "", requirements: "" };
}
export function changeCategory(draft: RequestDraft, category: string): RequestDraft {
  return { ...draft, category, answers: {} };
}
export type RequestErrors = Record<string, string>;
export function validateRequest(draft: RequestDraft, step: 0 | 1 | 2 = 2): RequestErrors {
  const errors: RequestErrors = {};
  const bounded = (key: string, value: string, max: number, required = true) => {
    if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) errors[key] = `Completa este campo (máximo ${max} caracteres).`;
  };
  const category = CATEGORIES.find(c => c.searchKey === draft.category);
  if (!category || !Object.hasOwn(REQUEST_SCHEMAS, draft.category)) errors.category = "Elige un servicio.";
  bounded("city", draft.city, 100);
  if (draft.city.trim().length < 2) errors.city = "Indica una ciudad o municipio (mínimo 2 caracteres).";
  if (step >= 1 && category) {
    for (const q of REQUEST_SCHEMAS[draft.category]) {
      const value = draft.answers[q.id] ?? "";
      bounded(q.id, value, 300, !q.optional);
      if (q.options && !q.options.includes(value)) errors[q.id] = "Elige una opción de la lista.";
    }
  }
  if (step >= 2) {
    bounded("timing", draft.timing, 200);
    bounded("duration", draft.duration, 200);
    bounded("exclusions", draft.exclusions, 300, false);
    bounded("requirements", draft.requirements, 300, false);
    if (!["fixed", "budget", "negotiable"].includes(draft.compensation)) errors.compensation = "Elige cómo se acordará el pago.";
    if (draft.compensation !== "negotiable" && (!/^\d{1,7}(\.\d{1,2})?$/.test(draft.amount) || Number(draft.amount) <= 0)) errors.amount = "Indica un monto positivo en RD$.";
    if (!(COMPENSATION_UNITS as readonly string[]).includes(draft.unit)) errors.unit = "Elige la unidad del pago.";
    if (draft.schemaVersion !== 1) errors.schemaVersion = "Versión de solicitud no válida.";
  }
  return errors;
}
/** Only known schema fields enter the summary; never infer missing terms. */
export function requestSummary(draft: RequestDraft): string {
  const category = CATEGORIES.find(c => c.searchKey === draft.category);
  const lines = [category?.label.toLocaleUpperCase("es-DO") ?? "SERVICIO POR DEFINIR", draft.city.trim() || "Ciudad por definir"];
  for (const q of category ? REQUEST_SCHEMAS[draft.category] : []) {
    const answer = draft.answers[q.id]?.trim();
    if (answer) lines.push(`${q.label}: ${answer}`);
  }
  lines.push(`Fecha y horario: ${draft.timing.trim() || "Por acordar"}`, `Duración: ${draft.duration.trim() || "Por acordar"}`);
  const amount = Number(draft.amount);
  lines.push(draft.compensation === "negotiable" ? "Pago: por acordar" : Number.isFinite(amount) && amount > 0 ? `${draft.compensation === "budget" ? "Presupuesto" : "Pago ofrecido"}: RD$${amount.toLocaleString("es-DO")} ${draft.unit}` : "Pago: por definir");
  if (draft.exclusions.trim()) lines.push(`No incluye: ${draft.exclusions.trim()}`);
  if (draft.requirements.trim()) lines.push(`Requisitos: ${draft.requirements.trim()}`);
  return lines.join("\n");
}
