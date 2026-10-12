"use client";
import { trackEvent } from "./analytics";
import { isValidWhatsAppUrl } from "./whatsapp";
import type { RequestDraft } from "./request-specification";

export async function openFreeWorkerContact(workerId: string, name: string, skill: string, draft: RequestDraft | null = null) {
  trackEvent("contact_click", { worker_id: workerId });
  const response = await fetch("/api/workers/contact", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft ? { workerId, draft } : { workerId }), signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  if (!response.ok || typeof data.url !== "string" || !isValidWhatsAppUrl(data.url)) throw new Error("CONTACT_UNAVAILABLE");
  const url = new URL(data.url);
  if (!draft) url.searchParams.set("text", `Hola ${name.split(" ")[0]}, te encontré en ListoRD. Necesito un(a) ${skill}. ¿Podemos confirmar tareas, horario y pago?`);
  window.location.assign(url.href);
}
