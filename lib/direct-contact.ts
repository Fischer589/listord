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
    if (origin.hostname !== requestHost && !([origin.hostname, requestHost].every(host => host === "listordapp.com" || host === "www.listordapp.com"))) return false;
    const production = [origin.hostname, requestHost].some(host => host === "listordapp.com" || host === "www.listordapp.com");
    return key.startsWith("sk_live_")
      ? process.env.DIRECT_CONTACT_LIVE_PAYMENTS_ENABLED === "true"
      : key.startsWith("sk_test_") && !production;
  } catch { return false; }
}
