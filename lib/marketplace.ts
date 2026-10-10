import { parseMatchRequest } from "./request-matching";
import { normalizeWhatsAppNumber } from "./whatsapp";

export const MARKETPLACE_HEADERS = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export const PUBLIC_OPPORTUNITY_COLUMNS = "id,category,city,scope,specification,timing_note,duration_note,compensation_kind,compensation_min,compensation_unit,currency,expires_at,status";
export const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function marketplaceEnabled() { return process.env.MARKETPLACE_ENABLED === "true"; }
export function object(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
}
export function publication(value: unknown) {
  const b = object(value);
  const draft = parseMatchRequest(b?.draft);
  if (!b || !draft || !uuid(b.key) || b.consent !== true || typeof b.name !== "string" || b.name.trim().length < 2 || b.name.trim().length > 100 || typeof b.phone !== "string" || b.phone.length > 40) return null;
  const phone = normalizeWhatsAppNumber(b.phone)?.replace(/^\+/, "") ?? "";
  if (!/^[1-9][0-9]{9,14}$/.test(phone)) return null;
  const units: Record<string, string> = { "por trabajo": "task", "por hora": "hour", "por día": "day", "por semana": "week", "por mes": "month" };
  return { key: b.key, name: b.name.trim(), phone, draft: {
    category: draft.category, city: draft.city, summary: Object.values(draft.answers).join(". "),
    specification: draft, timing: draft.timing, duration: draft.duration, compensation: draft.compensation,
    amount: draft.compensation === "negotiable" ? null : Number(draft.amount), unit: units[draft.unit]
  } };
}
