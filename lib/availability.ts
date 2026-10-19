export const AVAILABILITY_DAYS = 7;
export function isFreshAvailability(available: unknown, confirmedAt: unknown, now = new Date()): boolean {
  if (available !== true || typeof confirmedAt !== "string") return false;
  const timestamp = Date.parse(confirmedAt);
  return Number.isFinite(timestamp) && timestamp <= now.getTime() && timestamp > now.getTime() - AVAILABILITY_DAYS * 86400000;
}
/** Legacy Express outreach kill switch. Worker self-confirmation and guided matching
 * use the private availability ledger regardless of this sales setting. */
export function availabilityRenewalEnabled(): boolean {
  return process.env.WORKER_AVAILABILITY_RENEWAL_ENABLED === "true";
}
export function validAvailabilityKey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
