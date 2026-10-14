import { workspaceOrigin } from "./employer-workspace";

export const DIRECT_CONTACT_AMOUNT_CENTS = 8_900;
export const DIRECT_CONTACT_CURRENCY = "dop";
export const DIRECT_CONTACT_PURPOSE = "employer_direct_contact";

export function directContactReadEnabled() {
  return process.env.DIRECT_CONTACT_READ_ENABLED === "true";
}

export function directContactCheckoutReady(requestUrl: string) {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const price = process.env.STRIPE_DIRECT_CONTACT_PRICE_ID?.trim() ?? "";
  if (!directContactReadEnabled() || process.env.DIRECT_CONTACT_CHECKOUT_ENABLED !== "true" ||
      !/^price_[A-Za-z0-9]+$/.test(price)) return false;
  try {
    const origin = new URL(workspaceOrigin());
    const requestHost = new URL(requestUrl).hostname;
    const productionOrigin = origin.hostname === "listordapp.com" || origin.hostname === "www.listordapp.com";
    const productionRequest = requestHost === "listordapp.com" || requestHost === "www.listordapp.com";
    // Netlify can forward a request to a function under its deployment host.
    // The fixed return origin, live key, and explicit gate determine live safety.
    return key.startsWith("sk_live_")
      ? productionOrigin && process.env.DIRECT_CONTACT_LIVE_PAYMENTS_ENABLED === "true"
      : key.startsWith("sk_test_") && !productionOrigin && !productionRequest;
  } catch { return false; }
}
