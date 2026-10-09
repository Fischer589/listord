import { getWorkStyleValue, hasBlockedText } from "./worker-profile";
import { normalizeWhatsAppNumber } from "./whatsapp";

/** Validate before any privileged lookup/upload/write; never silently truncate. */
export function parseWorkerRegistration(form: FormData) {
  const limits: Record<string, number> = {
    full_name: 100, city: 100, whatsapp_number: 32, job_category: 100,
    skills: 1000, short_intro: 1200, desired_income: 20, work_style: 40
  };
  const values: Record<string, string> = {};
  for (const [key, max] of Object.entries(limits)) {
    const entries = form.getAll(key);
    if (entries.length > 1 || entries.some(value => typeof value !== "string")) return null;
    const value = String(entries[0] ?? "").trim();
    if (value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return null;
    values[key] = value;
  }
  const phone = normalizeWhatsAppNumber(values.whatsapp_number);
  const style = getWorkStyleValue(values.work_style || "flexible");
  const income = Number(values.desired_income || 0);
  const extras = values.skills.split(",").map(s => s.trim()).filter(Boolean);
  if (values.full_name.length < 2 || values.city.length < 2 || values.job_category.length < 2 ||
      !phone || !/^\+?[\d\s()-]+$/.test(values.whatsapp_number) || !style ||
      !Number.isFinite(income) || income < 0 || income > 10000000 ||
      extras.length > 20 || extras.some(s => s.length > 100) || hasBlockedText(Object.values(values))) return null;
  return {
    full_name: values.full_name, city: values.city, whatsapp_number: phone,
    work_style: style, short_intro: values.short_intro || "Disponible para trabajar.",
    skills: Array.from(new Set([values.job_category, ...extras])), desired_income: income,
    is_verified: false, available_now: false
  };
}
