import { parseMatchRequest } from "./request-matching";
import type { RequestDraft } from "./request-specification";

const DISCOVERY_KEY = "listord-discovery-request-v1";
const PROFILE_KEY = "listord-profile-request-v1";
const MAX_AGE_MS = 30 * 60 * 1000;

type StoredContext = { draft: RequestDraft; destination: string; createdAt: number };

function take(key: string, destination: string): RequestDraft | null {
  try {
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredContext;
    if (stored.destination !== destination || !Number.isFinite(stored.createdAt) ||
      Date.now() - stored.createdAt < 0 || Date.now() - stored.createdAt > MAX_AGE_MS) return null;
    return parseMatchRequest(stored.draft);
  } catch { return null; }
}

function store(key: string, draft: RequestDraft, destination: string) {
  const valid = parseMatchRequest(draft);
  if (!valid) return;
  try { sessionStorage.setItem(key, JSON.stringify({ draft: valid, destination, createdAt: Date.now() })); }
  catch { /* Private browsing or blocked storage keeps generic contact available. */ }
}

/** The draft stays in this browser tab; only service and city enter the directory URL. */
export function storeDiscoveryRequest(draft: RequestDraft, href: string) {
  const url = new URL(href, window.location.origin);
  store(DISCOVERY_KEY, draft, `${url.pathname}${url.search}`);
}

export function takeDiscoveryRequest(): RequestDraft | null {
  return take(DISCOVERY_KEY, `${window.location.pathname}${window.location.search}`);
}

export function storeProfileRequest(draft: RequestDraft, workerId: string) {
  store(PROFILE_KEY, draft, workerId);
}

export function takeProfileRequest(workerId: string): RequestDraft | null {
  return take(PROFILE_KEY, workerId);
}
