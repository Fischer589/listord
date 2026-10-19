import { workspaceOrigin, workspaceSessionPrefix } from "./employer-workspace";

export const CONTACT_CREDIT_PURPOSE = "employer_contact_credits";
export const CONTACT_CREDIT_PACKS = {
  1: { amount: 10000, env: "STRIPE_CONTACT_CREDIT_1_PRICE_ID", label: "1 contacto" },
  5: { amount: 44500, env: "STRIPE_CONTACT_CREDIT_5_PRICE_ID", label: "5 contactos" },
  10: { amount: 89000, env: "STRIPE_CONTACT_CREDIT_10_PRICE_ID", label: "10 contactos" },
} as const;
export type ContactCreditPack = keyof typeof CONTACT_CREDIT_PACKS;

export function parseContactCreditPack(value: unknown): ContactCreditPack | null {
  return value === 1 || value === 5 || value === 10 ? value : null;
}

export function contactCreditCheckoutReady(requestUrl: string) {
  const prefix = workspaceSessionPrefix();
  if (!prefix || process.env.CONTACT_CREDITS_CHECKOUT_ENABLED !== "true") return false;
  try {
    const origin = new URL(workspaceOrigin());
    const host = new URL(requestUrl).hostname;
    const production = ["listordapp.com", "www.listordapp.com"];
    if (prefix === "cs_live_") return production.includes(origin.hostname) && production.includes(host) &&
      process.env.CONTACT_CREDITS_LIVE_PAYMENTS_ENABLED === "true";
    return !production.includes(origin.hostname) && !production.includes(host);
  } catch { return false; }
}
