import { isFreshAvailability } from "./availability";
import { CATEGORIES } from "./categories";
import { normalizeText } from "./search";
import { publicWorkerText } from "./public-worker";
import { emptyRequest, REQUEST_SCHEMAS, validateRequest, type RequestDraft } from "./request-specification";

export const MATCH_WINDOW_DAYS = 30;
export const MATCH_COLUMNS = "id,full_name,city,skills,is_verified,available_now,created_at,desired_income,income_type";
export const MATCH_LIMIT = 1000;
export type MatchRow = {
  id: string; full_name: string | null; city: string | null; skills: string[] | null;
  is_verified: boolean | null; available_now: boolean | null; created_at: string | null;
  availability_confirmed_at?: string | null;
  desired_income: number | string | null; income_type: string | null;
};
export type RequestMatch = { id: string; name: string; city: string; reasons: string[]; scopeEvidence: string[] };
export type MatchResult = { count: number; workers: RequestMatch[]; checkedAt: string; windowDays: number; freshness?: "legacy" | "confirmed" };

/** Untrusted JSON boundary: validate types before invoking the shared form validator.
 * Unknown keys are rejected, never forwarded to the DB or to another worker. */
export function parseMatchRequest(value: unknown): RequestDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(emptyRequest());
  if (Object.keys(v).some(key => !keys.includes(key)) || v.schemaVersion !== 1) return null;
  for (const key of keys.filter(key => key !== "schemaVersion" && key !== "answers")) {
    if (typeof v[key] !== "string" || (v[key] as string).length > 300) return null;
  }
  if (!CATEGORIES.some(c => c.searchKey === v.category)) return null;
  if (!v.answers || typeof v.answers !== "object" || Array.isArray(v.answers)) return null;
  const schema = REQUEST_SCHEMAS[v.category as string];
  if (Object.keys(v.answers).some(key => !schema.some(q => q.id === key))) return null;
  if (Object.values(v.answers).some(answer => typeof answer !== "string" || answer.length > 300)) return null;
  const draft = v as unknown as RequestDraft;
  if (Object.keys(validateRequest(draft)).length || normalizeText(draft.city).length < 2) return null;
  return { ...draft, city: draft.city.trim(), answers: { ...draft.answers } };
}

// Deliberately narrower than directory synonym search: "hogar", "agua", "auto"
// and ambiguous "cuidadora" must not establish a different trade by themselves.
const TRADE_ALIASES: Record<string, string[]> = {
  limpieza: ["limpiadora", "limpiador", "empleada domestica", "limpieza del hogar"],
  cocina: ["cocinera", "cocinero", "chef"], plomeria: ["plomero", "plomera", "fontanero"],
  electricidad: ["electricista"], construccion: ["albanil", "albanileria", "constructor"],
  pintura: ["pintor", "pintora"], clases: ["tutor", "tutora", "profesor", "profesora", "matematicas", "ingles"],
  belleza: ["estilista", "manicurista", "maquillaje", "peluqueria", "barbero"],
  jardineria: ["jardinero", "jardinera"], conductor: ["chofer", "conductor", "delivery"],
  ninos: ["ninera", "ninero", "cuidado de ninos", "cuidado infantil"],
  cuidadora: ["cuidado adultos", "cuidado de adultos", "cuidado de adultos mayores", "enfermera", "enfermero"],
  carpinteria: ["carpintero", "carpintera", "ebanista"], seguridad: ["vigilante", "guardia de seguridad", "vigilancia"],
};
const UNITS: Record<string, string> = { "por hora": "hourly", "por día": "daily", "por semana": "weekly", "por mes": "monthly" };
export function matchWorker(row: MatchRow, draft: RequestDraft, now: Date, freshness: "legacy" | "confirmed" = "legacy"): RequestMatch | null {
  const created = Date.parse(row.created_at ?? "");
  // Creation is only a conservative upper bound on the age of the availability
  // flag. updated_at cannot refresh eligibility; paid boosts must not revive it.
  const fresh = freshness === "confirmed"
    ? isFreshAvailability(row.available_now, row.availability_confirmed_at, now)
    : Number.isFinite(created) && created <= now.getTime() && created >= now.getTime() - MATCH_WINDOW_DAYS * 86400000;
  if (row.is_verified !== true || row.available_now !== true || !fresh) return null;
  if (!row.id || !row.full_name?.trim() || !row.city || !Array.isArray(row.skills) || row.skills.some(skill => typeof skill !== "string")) return null;
  if (normalizeText(row.city) !== normalizeText(draft.city)) return null;
  const category = CATEGORIES.find(c => c.searchKey === draft.category)!;
  const trades = [...TRADE_ALIASES[draft.category], category.label];
  // Generic 'cuidadora' is ambiguous between child/adult care.
  if (draft.category !== "cuidadora") trades.push(category.searchKey);
  const skills = row.skills.map(normalizeText);
  if (!skills.some(skill => trades.some(trade => skill === normalizeText(trade)))) return null;
  const income = Number(row.desired_income);
  const comparable = draft.compensation !== "negotiable" && Boolean(UNITS[draft.unit]) && UNITS[draft.unit] === row.income_type && Number.isFinite(income) && income > 0;
  if (comparable && income > Number(draft.amount)) return null;
  // Exact skill phrases found in the scope are evidence, not an inference that
  // every requested task/qualification is supported. They never alter eligibility.
  const scope = ` ${normalizeText(Object.values(draft.answers).join(" "))} `;
  const scopeEvidence = row.skills.filter(skill => publicWorkerText(skill) && normalizeText(skill).length >= 4 && scope.includes(` ${normalizeText(skill)} `));
  return {
    id: row.id, name: publicWorkerText(row.full_name) || "Trabajador ListoRD", city: publicWorkerText(row.city) || "República Dominicana",
    reasons: ["Oficio en su perfil", "Misma ciudad", "Disponibilidad declarada", ...(comparable ? ["Monto compatible en la misma unidad"] : [])],
    scopeEvidence: scopeEvidence.slice(0, 3),
  };
}

export type MatchPage = { data: MatchRow[] | null; count: number | null; error: unknown };
export async function findMatches(draft: RequestDraft, load: () => PromiseLike<MatchPage>, now = new Date(), freshness: "legacy" | "confirmed" = "legacy"): Promise<MatchResult> {
  const { data, count, error } = await load();
  // Refuse truncated/partial data instead of advertising an inaccurate count.
  if (error || !data || count === null || count > MATCH_LIMIT || data.length !== count || new Set(data.map(row => row.id)).size !== data.length) throw new Error("MATCH_DATA_UNAVAILABLE");
  const workers = data.map(row => matchWorker(row, draft, now, freshness)).filter((row): row is RequestMatch => row !== null);
  workers.sort((a, b) => b.scopeEvidence.length - a.scopeEvidence.length || a.id.localeCompare(b.id));
  return { count: workers.length, workers, checkedAt: now.toISOString(), windowDays: MATCH_WINDOW_DAYS, freshness };
}
