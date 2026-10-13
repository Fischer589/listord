import { parseMatchRequest } from "./request-matching";
import type { RequestDraft } from "./request-specification";

const key = "listord-pending-publication-draft-v1";
const lifetimeMs = 2 * 60 * 60_000;

/** A same-tab recovery aid; it never publishes or shares a draft. */
export function savePendingPublicationDraft(draft: RequestDraft) {
  const parsed = parseMatchRequest(draft);
  if (!parsed) return false;
  try {
    sessionStorage.setItem(key, JSON.stringify({ draft: parsed, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function takePendingPublicationDraft(): RequestDraft | null {
  try {
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { draft?: unknown; savedAt?: unknown };
    if (typeof stored.savedAt !== "number" || stored.savedAt > Date.now() || Date.now() - stored.savedAt > lifetimeMs) return null;
    return parseMatchRequest(stored.draft);
  } catch { return null; }
}

export function clearPendingPublicationDraft() {
  try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}
