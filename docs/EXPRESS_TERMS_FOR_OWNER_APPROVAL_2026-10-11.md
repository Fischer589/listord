# ListoRD Express — proposed terms for owner approval

**Status: proposed, not accepted or live.** Code identifier: `express-v1-draft`. No production flag or customer record represents these terms as approved. This document describes the current code path and the decisions the owner must make before accepting it.

## Proposed customer-facing terms (Spanish)

> ListoRD Express cuesta RD$299 DOP por una solicitud aprobada, en un solo pago. Antes de ofrecer el pago, verificamos que haya al menos un perfil compatible que haya autorizado recibir invitaciones por WhatsApp y confirmado recientemente su disponibilidad. El número mostrado es de destinatarios elegibles, no de personas que ya aceptaron el trabajo.
>
> Después de confirmar el pago, ListoRD invita a esos perfiles. El plazo para recibir una respuesta “SÍ, me interesa” es de 24 horas desde la confirmación del pago en ListoRD. “SÍ” significa interés en conversar y permite compartir el contacto con quien publicó la solicitud; no confirma contratación, asistencia, precio final ni calidad del trabajo.
>
> Si no llega ninguna respuesta “SÍ” válida dentro de ese plazo, si la solicitud se cierra antes, o si deja de haber destinatarios con consentimiento vigente, corresponde un reembolso total de RD$299. ListoRD revisa y procesa ese reembolso por el canal de pago original cuando sea posible. La pantalla mostrará “reembolso pendiente” hasta que el proveedor confirme el movimiento. No consideres una redirección de Checkout como confirmación del pago.
>
> Las invitaciones dependen del consentimiento vigente de cada trabajador. Puedes consultar el estado con la referencia de tu solicitud. El contacto posterior, la negociación y la decisión de contratar quedan entre las personas participantes.

## Approval decisions and implementation alignment

- **Price and product:** keep the already implemented RD$299 DOP one-time price, one paid Express order per opportunity, and no hiring guarantee. Any price or product change requires separate authorization and code review.
- **Remedy and timing:** approve the full-refund triggers above, name the responsible operator and support channel, and choose a concrete processing target and treatment when the original payment method cannot receive a refund. The ledger marks `remedy_due`; an operator must actually process the refund with Stripe or the transfer provider, then record the external reference. There is no automatic money movement.
- **Clock:** confirm that the 24-hour clock starts when the signed webhook or independently verified transfer is recorded as paid in ListoRD. Delayed webhooks can start the clock later than the customer's card authorization, never earlier.
- **Provider behavior:** approve the exact Spanish WhatsApp template, its opt-out text, language `es`, consent record, and dispatch operator. A Meta message ID shows provider acceptance only; a worker's authenticated YES is separate.
- **Settlement and hosting:** verify DOP presentment and actual account settlement/refund behavior in Stripe test mode. Stripe documents DOP presentment but account settlement depends on the account. Vercel Hobby disallows payment requests or processing; select compliant hosting before any live sales.

After approval, update the accepted version and customer-facing copy in code, review the final text, then set `EXPRESS_ACCEPTED_TERMS` to that exact approved version. Keep `EXPRESS_ENABLED=false` until test-mode checkout, signed webhook, refund, WhatsApp template and hosting acceptance are complete. The draft identifier must never be treated as owner approval.

Sources: [Stripe testing](https://docs.stripe.com/testing), [Stripe currencies](https://docs.stripe.com/currencies), [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines).
