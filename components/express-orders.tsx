"use client";
import { useState } from "react";
import { EXPRESS_DESCRIPTION, EXPRESS_TERMS } from "@/lib/express";
import { marketplaceRequest } from "./marketplace-session";
type OrderStatus = { id: string; opportunity_id: string; status: string; amount: number; currency: string; deadline: string | null; reference: string };
const labels: Record<string, string> = { payment_pending: "Pago pendiente", paid: "Pago confirmado; buscando respuestas", fulfilled: "Interés confirmado; no equivale a contratación", remedy_due: "Reembolso total pendiente de procesar", refunded: "Reembolso registrado" };
export function ExpressOrders({ token, opportunities }: { token: string; opportunities: { id: string; city: string; status: string }[] }) {
  const [orders, setOrders] = useState<OrderStatus[]>([]); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false); const [consent, setConsent] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, number>>({});
  async function quote(id: string) {
    setBusy(true); setNotice("");
    try { const data = await marketplaceRequest(token, undefined, `/api/express?id=${id}`); setQuotes(previous => ({ ...previous, [id]: data.eligibleCount })); setNotice(`${data.eligibleCount} perfiles compatibles con consentimiento para recibir la invitación. Aún no han confirmado interés.`); }
    catch (e) { setNotice(e instanceof Error ? e.message : "No se pudo verificar la entrega."); }
    finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true);
    try { const data = await marketplaceRequest(token, undefined, "/api/express"); setOrders(data.orders); setNotice(data.orders.length ? "Estado actualizado desde el registro de pagos." : "No tienes órdenes Express."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "No se pudo cargar el estado."); } finally { setBusy(false); }
  }
  async function checkout(id: string, channel: string) {
    setBusy(true); setNotice("");
    try {
      const data = await marketplaceRequest(token, { id, channel, terms: EXPRESS_TERMS }, "/api/express");
      if (data.url) {
        const url = new URL(data.url);
        if (url.protocol !== "https:" || !["checkout.stripe.com", "wa.me"].includes(url.hostname)) throw new Error("Enlace de pago no válido.");
        window.location.assign(url.href);
      } else setNotice("Ya existe una orden. Actualiza el estado para consultarla.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "No se confirmó el pago."); } finally { setBusy(false); }
  }
  return <section><h2>ListoRD Express</h2><p>{EXPRESS_DESCRIPTION}</p><p>El estado de pago se confirma en el servidor. Volver de Stripe o abrir WhatsApp no confirma un pago ni activa el servicio.</p><p role="status">{notice}</p><button disabled={busy} onClick={refresh}>Actualizar mis pagos</button>
    {orders.map(o => <article key={o.id}><h3>{labels[o.status] ?? "Revisión pendiente"}</h3><p>RD${(o.amount / 100).toFixed(2)} · Referencia {o.reference}</p>{o.deadline && <p>Plazo: {new Date(o.deadline).toLocaleString("es-DO")}</p>}</article>)}
    <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Entiendo los términos, el plazo, el reembolso sin respuesta SÍ y que no se garantiza contratación.</label>
    {opportunities.filter(o => o.status === "open").map(o => <div key={o.id} className="request-actions"><span>{o.city}</span><button disabled={busy} onClick={() => quote(o.id)}>Verificar perfiles para Express</button><button disabled={busy || !consent || !quotes[o.id]} onClick={() => checkout(o.id, "stripe")}>Solicitar pago con tarjeta RD$299</button><button disabled={busy || !consent || !quotes[o.id]} onClick={() => checkout(o.id, "transfer")}>Consultar transferencia RD$299</button></div>)}
  </section>;
}
