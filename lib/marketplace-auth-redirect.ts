export type MarketplaceAuthIntent = "publish" | "apply" | "account" | "direct" | "worker";

const destinations: Record<MarketplaceAuthIntent, string> = {
  publish: "/solicitar",
  apply: "/oportunidades",
  account: "/empleadores/mi-cuenta",
  direct: "/empleadores/contacto",
  worker: "/trabajadores/activar",
};

export function marketplaceAuthDestination(intent: string, workerId?: string | null) {
  if (!Object.prototype.hasOwnProperty.call(destinations, intent)) return null;
  const destination = destinations[intent as MarketplaceAuthIntent];
  return intent === "direct" && workerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workerId)
    ? `${destination}?worker=${encodeURIComponent(workerId)}` : destination;
}

/** Only ListoRD hosts can appear in email verification links. */
export function marketplaceAuthCallbackUrl(intent: MarketplaceAuthIntent, currentOrigin: string, workerId?: string | null) {
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
  const destination = marketplaceAuthDestination(intent, workerId);
  const worker = intent === "direct" && destination?.includes("?worker=") ? destination.slice(destination.indexOf("?")) : "";
  return `${origin}/auth/callback/${intent}${worker}`;
}
