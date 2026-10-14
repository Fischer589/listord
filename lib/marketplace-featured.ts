import { workspaceOrigin } from "./employer-workspace";

export const FEATURED_AMOUNT_CENTS = 14_900;
export const FEATURED_CURRENCY = "dop";
export const FEATURED_DAYS = 7;
export const FEATURED_PURPOSE = "marketplace_featured_7d";

/** Keep Checkout open only while a full seven days can still be delivered. */
export function featuredSessionExpiresAt(opportunityExpiresAt: string, now = Date.now()) {
  const expiry = Date.parse(opportunityExpiresAt);
  if (!Number.isFinite(expiry)) return null;
  const nowSeconds = Math.floor(now / 1000);
  const latest = Math.floor(expiry / 1000) - FEATURED_DAYS * 86400 - 120;
  const sessionExpiresAt = Math.min(nowSeconds + 45 * 60, latest);
  return sessionExpiresAt >= nowSeconds + 31 * 60 ? sessionExpiresAt : null;
}

/** Schema/read activation is separate from accepting new payments. */
export function featuredReadEnabled() {
  return process.env.FEATURED_OPPORTUNITIES_ENABLED === "true";
}

export function featuredCheckoutEnabled() {
  return featuredReadEnabled() && process.env.FEATURED_CHECKOUT_ENABLED === "true";
}

export function featuredCheckoutReady(requestUrl: string) {
  if (!featuredCheckoutEnabled()) return false;
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  let origin: URL;
  let request: URL;
  try { origin = new URL(workspaceOrigin()); request = new URL(requestUrl); }
  catch { return false; }
  const productionHost = (host: string) => host === "listordapp.com" || host === "www.listordapp.com";
  if (key.startsWith("sk_test_")) return !productionHost(origin.hostname) && !productionHost(request.hostname);
  return key.startsWith("sk_live_") && process.env.FEATURED_LIVE_PAYMENTS_ENABLED === "true";
}
