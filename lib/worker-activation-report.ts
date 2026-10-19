import { CATEGORIES } from "./categories";
import { isFreshAvailability } from "./availability";
import { matchWorker, workerHasTradeCategory, type MatchRow } from "./request-matching";
import { emptyRequest } from "./request-specification";
import { normalizeText } from "./search";

export type ActivationWorker = MatchRow & { owner_user_id: string | null };
export type ActivationRecord = {
  worker_id: string; available: boolean; confirmed_at: string | null; access_expires_at: string;
};
type Counts = { verified: number; invited: number; confirmedAvailable: number; currentlyMatchable: number };

/** Admin-only aggregate. Each worker appears once in totals and once per strict trade category. */
export function buildWorkerActivationReport(workers: ActivationWorker[], records: ActivationRecord[], now = new Date()) {
  const byWorker = new Map(records.map(record => [record.worker_id, record]));
  const groups = new Map<string, { city: string; category: string; counts: Counts }>();
  const totals: Counts = { verified: 0, invited: 0, confirmedAvailable: 0, currentlyMatchable: 0 };
  const seen = new Set<string>();
  for (const worker of workers) {
    if (worker.is_verified !== true || seen.has(worker.id)) continue;
    seen.add(worker.id);
    const record = byWorker.get(worker.id);
    const confirmed = record?.available === true && typeof record.confirmed_at === "string" &&
      Number.isFinite(Date.parse(record.confirmed_at)) && Date.parse(record.confirmed_at) <= now.getTime();
    const city = normalizeText(worker.city ?? "") || "sin ciudad";
    const categories = CATEGORIES.filter(category => workerHasTradeCategory(worker.skills, category.searchKey))
      .map(category => category.searchKey);
    if (!categories.length) categories.push("sin categoria");
    const matchable = Boolean(confirmed && worker.owner_user_id && record && record.access_expires_at &&
      Date.parse(record.access_expires_at) > now.getTime() && worker.available_now === true &&
      isFreshAvailability(true, record.confirmed_at, now) && categories.some(category => category !== "sin categoria" &&
        matchWorker({ ...worker, availability_confirmed_at: record.confirmed_at },
          { ...emptyRequest(), city: worker.city ?? "", category, compensation: "negotiable" }, now, "confirmed")));
    const values: Counts = { verified: 1, invited: Number(Boolean(record)),
      confirmedAvailable: Number(confirmed), currentlyMatchable: Number(matchable) };
    for (const key of Object.keys(totals) as (keyof Counts)[]) totals[key] += values[key];
    for (const category of categories) {
      const groupKey = `${city}\u0000${category}`;
      const group = groups.get(groupKey) ?? { city, category,
        counts: { verified: 0, invited: 0, confirmedAvailable: 0, currentlyMatchable: 0 } };
      for (const key of Object.keys(group.counts) as (keyof Counts)[]) group.counts[key] += values[key];
      groups.set(groupKey, group);
    }
  }
  return { asOf: now.toISOString(), totals, rows: Array.from(groups.values())
    .sort((a, b) => a.city.localeCompare(b.city) || a.category.localeCompare(b.category)) };
}
