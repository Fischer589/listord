export const WORKSPACE_AMOUNT_CENTS = 29_900;
export const WORKSPACE_CURRENCY = "dop";
export const WORKSPACE_DAYS = 30;
export const WORKSPACE_PURPOSE = "employer_workspace_30d";

/** Keep test Checkout orders from authorizing contact in a live deployment. */
export function workspaceSessionPrefix() {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (key.startsWith("sk_live_")) return "cs_live_";
  if (key.startsWith("sk_test_")) return "cs_test_";
  return null;
}

export function workspaceSessionPattern(prefix: string) {
  return `${prefix.replaceAll("_", "\\_")}%`;
}

export function workspaceEnabled() {
  return process.env.EMPLOYER_WORKSPACE_ENABLED === "true";
}

function isProductionHost(host: string) {
  return host === "listordapp.com" || host === "www.listordapp.com";
}

export function workspaceStripeReady(requestUrl: string) {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (key.startsWith("sk_test_")) {
    try {
      return !isProductionHost(new URL(workspaceOrigin()).hostname) &&
        !isProductionHost(new URL(requestUrl).hostname);
    } catch {
      return false;
    }
  }
  return key.startsWith("sk_live_") && process.env.WORKSPACE_LIVE_PAYMENTS_ENABLED === "true";
}

export function workspaceOrigin() {
  const url = new URL(process.env.APP_ORIGIN?.trim() ?? "");
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("INVALID_ORIGIN");
  }
  return url.origin;
}

export function workspaceAccessUntil(paidAt: Date) {
  return new Date(paidAt.getTime() + WORKSPACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
