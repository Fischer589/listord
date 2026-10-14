export type MarketplaceAuthIntent = "publish" | "apply" | "account" | "direct";

const destinations: Record<MarketplaceAuthIntent, string> = {
  publish: "/solicitar",
  apply: "/oportunidades",
  account: "/empleadores/mi-cuenta",
  direct: "/empleadores/contacto",
};

export function marketplaceAuthDestination(intent: string) {
  return Object.prototype.hasOwnProperty.call(destinations, intent)
    ? destinations[intent as MarketplaceAuthIntent]
    : null;
}

/** Only ListoRD hosts can appear in email verification links. */
export function marketplaceAuthCallbackUrl(intent: MarketplaceAuthIntent, currentOrigin: string) {
  let origin = "https://listordapp.com";
  try {
    const candidate = new URL(currentOrigin);
    const host = candidate.hostname.toLowerCase();
    const listordHost = host === "listordapp.com" || host === "www.listordapp.com" ||
      host === "listord-2.netlify.app" || host === "release-candidate--listord-2.netlify.app";
    const localHost = host === "localhost" || host === "127.0.0.1";
    if (!candidate.username && !candidate.password && candidate.pathname === "/" && !candidate.search && !candidate.hash &&
        ((candidate.protocol === "https:" && listordHost) || ((candidate.protocol === "http:" || candidate.protocol === "https:") && localHost))) {
      origin = candidate.origin;
    }
  } catch { /* Invalid origins fall back to the canonical ListoRD host. */ }
  return `${origin}/auth/callback/${intent}`;
}
