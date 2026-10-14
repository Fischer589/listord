"use client";
import { trackEvent } from "./analytics";
import { getMarketplaceBrowserClient, restoreMarketplaceSession } from "./marketplace-browser";
import { isValidWhatsAppUrl } from "./whatsapp";
import type { RequestDraft } from "./request-specification";

export function rememberSelectedWorker(workerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(workerId)) return;
  try { localStorage.setItem("listord-selected-worker-v1", JSON.stringify({ id: workerId, until: Date.now() + 24 * 60 * 60_000 })); }
  catch { /* The URL still carries the selection during this navigation. */ }
}

export function selectedWorker() {
  try {
    const saved = JSON.parse(localStorage.getItem("listord-selected-worker-v1") ?? "null") as { id?: string; until?: number } | null;
    return saved && typeof saved.id === "string" && /^[0-9a-f-]{36}$/i.test(saved.id) && typeof saved.until === "number" && saved.until > Date.now() ? saved.id : null;
  } catch { return null; }
}

export async function openFreeWorkerContact(workerId: string, name: string, skill: string, draft: RequestDraft | null = null): Promise<"opened" | "paywall"> {
  rememberSelectedWorker(workerId);
  const client = getMarketplaceBrowserClient();
  const token = client ? (await restoreMarketplaceSession(client))?.access_token : null;
  if (!token) { trackEvent("paywall_open", { worker_id: workerId }); return "paywall"; }
  const response = await fetch("/api/workers/contact", {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(draft ? { workerId, draft } : { workerId }), signal: AbortSignal.timeout(12000),
  });
  if (response.status === 401 || response.status === 402) { trackEvent("paywall_open", { worker_id: workerId }); return "paywall"; }
  const data = await response.json();
  if (!response.ok || typeof data.url !== "string" || !isValidWhatsAppUrl(data.url)) throw new Error("CONTACT_UNAVAILABLE");
  const url = new URL(data.url);
  if (!draft) url.searchParams.set("text", `Hola ${name.split(" ")[0]}, te encontré en ListoRD. Necesito un(a) ${skill}. ¿Podemos confirmar tareas, horario y pago?`);
  trackEvent("contact_click", { worker_id: workerId });
  window.location.assign(url.href);
  return "opened";
}
