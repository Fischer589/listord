import { CATEGORIES } from "./categories";

export type EmployerRequestStatus = "new" | "contacted" | "matching" | "completed";

export const EMPLOYER_REQUEST_STATUSES: EmployerRequestStatus[] = [
  "new",
  "contacted",
  "matching",
  "completed"
];

export const EMPLOYER_REQUEST_STATUS_LABELS: Record<EmployerRequestStatus, string> = {
  new: "Nueva",
  contacted: "Contactado",
  matching: "Buscando candidatos",
  completed: "Completada"
};

export type ClientType =
  | "Persona particular"
  | "Empresa"
  | "Administrador de propiedad"
  | "Airbnb"
  | "Restaurante"
  | "Hotel"
  | "Oficina"
  | "Otro";

export const CLIENT_TYPES: ClientType[] = [
  "Persona particular",
  "Empresa",
  "Administrador de propiedad",
  "Airbnb",
  "Restaurante",
  "Hotel",
  "Oficina",
  "Otro"
];

export type EmploymentType =
  | "Tiempo completo"
  | "Medio tiempo"
  | "Por días"
  | "Por horas"
  | "Trabajo único";

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  "Tiempo completo",
  "Medio tiempo",
  "Por días",
  "Por horas",
  "Trabajo único"
];

export type EmployerRequest = {
  id: string;
  created_at: string;
  name: string;
  client_type: string;
  service_needed: string;
  category_source: "catalog" | "otro";
  location: string;
  description: string;
  employment_type: string;
  budget: string | null;
  whatsapp: string;
  email: string | null;
  status: EmployerRequestStatus;
};

/**
 * Worker category options for the employer request form — pulled directly
 * from the existing worker category system (lib/categories.ts) so employer
 * requests use the EXACT same value format (`searchKey`) that worker
 * profiles are matched against in lib/search.ts. This is what makes future
 * employer↔worker matching possible without a second taxonomy.
 */
export const EMPLOYER_CATEGORY_OPTIONS = CATEGORIES.map((category) => ({
  value: category.searchKey,
  label: category.label
}));

export const OTRO_CATEGORY_VALUE = "otro";

export function isKnownCategoryValue(value: string): boolean {
  return CATEGORIES.some((category) => category.searchKey === value);
}
