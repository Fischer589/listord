import type { Invitation } from "./express";
import { normalizeWhatsAppUrlPhoneNumber } from "./whatsapp";

export function outreachConfigured() {
  return /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_VERSION ?? "")
    && /^\d{5,30}$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID ?? "")
    && /^[a-z0-9_]{1,100}$/.test(process.env.WHATSAPP_EXPRESS_TEMPLATE ?? "")
    && Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim());
}
/** Reviewed Meta template body takes one public opportunity URL. The template
 * itself must explain opt-out; account, language, template and provider remain gated. */
export async function sendExpressInvitation(invitation: Invitation, fetcher: typeof fetch = fetch) {
  if (!outreachConfigured()) throw new Error("OUTREACH_UNAVAILABLE");
  const phone = normalizeWhatsAppUrlPhoneNumber(invitation.phone);
  const origin = new URL(process.env.APP_ORIGIN ?? "");
  if (!phone || origin.protocol !== "https:" || origin.username || origin.password) throw new Error("OUTREACH_UNAVAILABLE");
  const response = await fetcher(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "template", template: {
      name: process.env.WHATSAPP_EXPRESS_TEMPLATE, language: { code: "es" },
      components: [{ type: "body", parameters: [{ type: "text", text: `${origin.origin}/oportunidades?id=${invitation.opportunity_id}` }] }]
    } })
  });
  if (!response.ok) throw new Error("DELIVERY_UNCONFIRMED");
  const data = await response.json();
  const id = data.messages?.[0]?.id;
  if (typeof id !== "string" || id.length < 5 || id.length > 200) throw new Error("DELIVERY_UNCONFIRMED");
  // Provider acceptance is not delivery/read confirmation, interest, or a hire.
  return id;
}
