/** Keep exposed legacy capabilities and new legacy sales off until separately
 * reviewed recovery/entitlement acceptance. These gates never affect webhooks. */
export function legacyWorkerEditingEnabled() {
  return process.env.LEGACY_WORKER_EDIT_ENABLED === "true";
}
export function legacyCheckoutEnabled() {
  return process.env.LEGACY_CHECKOUT_ENABLED === "true";
}
