"use client";
import { FormEvent, useState } from "react";
type Review = { id: string; specification: unknown };
type Order = { id: string; status: string; channel: string; amount: number; reference: string };
async function adminRequest(path: string, body?: unknown) {
  const r = await fetch(`/api/admin/${path}`, { method: body ? "POST" : "GET", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  if (r.redirected) throw new Error("Inicia sesión de nuevo.");
  const data = await r.json(); if (!r.ok) throw new Error(data.error ?? "Operación no confirmada."); return data;
}
export function MarketplaceAdminPanel() {
  const [reports, setReports] = useState<{ id: string; opportunity_id: string; reason: string }[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]); const [orders, setOrders] = useState<Order[]>([]); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  async function load() {
    setBusy(true);
    try { const [a, b] = await Promise.all([adminRequest("marketplace"), adminRequest("express")]); setReports(a.reports); setReviews(a.opportunities); setOrders(b.orders); setNotice("Registros cargados. Revisa todos los términos antes de aprobar."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "No se pudieron cargar los registros."); } finally { setBusy(false); }
  }
  async function action(path: string, body: unknown) {
    setBusy(true);
    try { const data = await adminRequest(path, body); setNotice(data.sent === false ? "No hay invitación elegible pendiente. No se envió ningún mensaje." : data.sent === true ? `Proveedor aceptó ${data.acceptedCount} invitaciones. No implica entrega ni respuesta.` : "Operación registrada. Actualiza los registros para confirmar el estado."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Operación no confirmada."); } finally { setBusy(false); }
  }
  function moderate(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    void action("marketplace", { id, approve: true, privacyReviewed: form.get("privacy") === "on" });
  }
  function payment(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void action("express", { id, action: f.get("action"), reference: f.get("reference"), operator: f.get("operator"), amount: Number(f.get("amount")), currency: "dop", evidenceConfirmed: f.get("evidence") === "on" });
  }
  function linkOwner(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void action("marketplace", { action: "link_owner", id: f.get("worker"), owner: f.get("owner"), evidence: f.get("evidence"), operator: f.get("operator"), identityVerified: f.get("verified") === "on" });
  }
  return <><button disabled={busy} onClick={load}>Actualizar registros</button><p role="status">{notice}</p><h2>Moderación</h2>
    {reviews.map(r => <article key={r.id}><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(r.specification, null, 2)}</pre><form onSubmit={e => moderate(e, r.id)}><label><input type="checkbox" name="privacy" required /> Revisé todos los campos: términos completos, sin teléfonos, direcciones exactas, nombres privados ni datos sensibles.</label><button disabled={busy}>Aprobar publicación</button><button type="button" disabled={busy} onClick={() => action("marketplace", { id: r.id, approve: false })}>Rechazar</button></form></article>)}
    <h2>Vincular titular verificado</h2><p>Solo tras verificar al titular por el procedimiento aprobado. El correo por sí solo, un teléfono y los enlaces antiguos no prueban propiedad. No reemplaza titulares ni activa perfiles.</p><form className="request-fields" onSubmit={linkOwner}><label>ID del perfil<input name="worker" required /></label><label>ID de cuenta verificada<input name="owner" required /></label><label>Referencia de evidencia privada<input name="evidence" pattern="[A-Za-z0-9:_-]{5,160}" required /></label><label>Responsable de verificación<input name="operator" pattern="[A-Za-z0-9_-]{3,60}" required /></label><label><input type="checkbox" name="verified" required /> Verifiqué al titular con evidencia independiente y su consentimiento para vincular esta cuenta.</label><button disabled={busy}>Vincular sin activar</button></form>
    <h2>Reportes</h2>{reports.map(r => <article key={r.id}><p>{r.reason} · <a href={`/oportunidades?id=${r.opportunity_id}`} target="_blank" rel="noreferrer">Revisar oportunidad</a></p><button disabled={busy} onClick={() => action("marketplace", { action: "resolve_report", id: r.id, remove: true })}>Retirar publicación y resolver</button><button disabled={busy} onClick={() => action("marketplace", { action: "resolve_report", id: r.id, remove: false })}>Resolver sin retirar</button></article>)}
    <h2>Pagos y cumplimiento</h2><p>Verifica el recibo en el proveedor; una captura aportada por el cliente no demuestra pago. Registrar reembolso exige haberlo completado externamente. No se inicia aquí un movimiento bancario.</p>
    {orders.map(o => <article key={o.id}><h3>{o.status} · {o.channel}</h3><p>RD${(o.amount / 100).toFixed(2)} · {o.reference}</p><div className="request-actions"><button disabled={busy} onClick={() => action("express", { id: o.id, action: "reconcile" })}>Reconciliar plazo y respuestas</button><button disabled={busy || o.status !== "paid"} onClick={() => action("express", { id: o.id, action: "dispatch" })}>Enviar invitaciones consentidas</button></div>
      <form className="request-fields" onSubmit={e => payment(e, o.id)}><label>Operación<select name="action"><option value="transfer_paid">Confirmar transferencia recibida</option><option value="refund_recorded">Registrar reembolso completado</option></select></label><label>Responsable<input name="operator" pattern="[A-Za-z0-9_-]{3,60}" required /></label><label>Referencia externa única<input name="reference" pattern="[A-Za-z0-9:_-]{5,160}" required /></label><label>Monto recibido en centavos DOP<input name="amount" type="number" min="29900" max="29900" defaultValue="29900" required /></label><label><input name="evidence" type="checkbox" required /> Verifiqué la evidencia externa y el monto completo.</label><button disabled={busy}>Registrar evidencia</button></form>
    </article>)}</>;
}
