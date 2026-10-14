"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { REQUEST_SCHEMAS } from "@/lib/request-specification";
type Status = "pending" | "approved" | "rejected";
type Review = { id: string; category: string; city: string; scope: string; specification: unknown; starts_at: string | null; timing_note: string | null; duration_minutes: number | null; duration_note: string | null; compensation_kind: string; compensation_min: number | null; compensation_max: number | null; compensation_unit: string | null; created_at: string; expires_at: string; status: string; moderation_status: Status };
const labels: Record<Status, string> = { pending: "Pendientes", approved: "Aprobadas", rejected: "Rechazadas" };
const units: Record<string, string> = { hour: "hora", day: "día", week: "semana", month: "mes", task: "trabajo" };
function date(value: string | null) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Santo_Domingo" }).format(new Date(value)) : "No indicada"; }
function pay(r: Review) {
  if (r.compensation_kind === "negotiable" || r.compensation_min == null) return "Por acordar";
  const money = (n: number) => "RD$" + Number(n).toLocaleString("es-DO", { maximumFractionDigits: 2 });
  return (r.compensation_kind === "budget" ? "Presupuesto " : "Pago ") + money(r.compensation_min) + (r.compensation_max && r.compensation_max !== r.compensation_min ? "–" + money(r.compensation_max) : "") + (r.compensation_unit ? " por " + (units[r.compensation_unit] ?? r.compensation_unit) : "");
}
function answers(spec: unknown, category: string) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return [];
  const draft = spec as Record<string, unknown>;
  const values = draft.answers && typeof draft.answers === "object" && !Array.isArray(draft.answers) ? draft.answers as Record<string, unknown> : {};
  const fields = (REQUEST_SCHEMAS[category] ?? []).flatMap(question => {
    const value = values[question.id];
    return typeof value === "string" && value.trim() ? [{ label: question.label, value: value.trim() }] : [];
  });
  for (const [key, label] of [["requirements", "Requisitos"], ["exclusions", "No incluye"]] as const) {
    const value = draft[key]; if (typeof value === "string" && value.trim()) fields.push({ label, value: value.trim() });
  }
  return fields;
}
type Order = { id: string; status: string; channel: string; amount: number; reference: string };
type EarlyClosure = { id: string; opportunity_id: string; paid_at: string; featured_until: string };
async function adminRequest(path: string, body?: unknown) {
  const r = await fetch(`/api/admin/${path}`, { method: body ? "POST" : "GET", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  if (r.redirected) throw new Error("Inicia sesión de nuevo.");
  const data = await r.json(); if (!r.ok) throw new Error(data.error ?? "Operación no confirmada."); return data;
}
export function MarketplaceAdminPanel({ expressAvailable }: { expressAvailable: boolean }) {
  const [reports, setReports] = useState<{ id: string; opportunity_id: string; reason: string; created_at: string }[]>([]);
  const [earlyClosures, setEarlyClosures] = useState<EarlyClosure[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]); const [orders, setOrders] = useState<Order[]>([]); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(""); const [error, setError] = useState(false);
  const [counts, setCounts] = useState<Record<Status, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [filter, setFilter] = useState<Status>("pending");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<{ id: string; approve: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Review | null>(null);
  const load = useCallback(async () => {
    const a = await adminRequest("marketplace"); setReports(a.reports ?? []); setEarlyClosures(a.earlyClosures ?? []); setReviews(a.opportunities ?? []); setCounts(a.counts ?? { pending: 0, approved: 0, rejected: 0 });
    if (expressAvailable) setOrders((await adminRequest("express")).orders ?? []);
  }, [expressAvailable]);
  useEffect(() => { void load().catch(e => { setError(true); setNotice(e instanceof Error ? e.message : "No se pudieron cargar los registros."); }); }, [load]);
  async function refresh() { setBusy(true); setNotice(""); try { await load(); setError(false); setNotice("Registros actualizados."); } catch (e) { setError(true); setNotice(e instanceof Error ? e.message : "No se pudieron cargar los registros."); } finally { setBusy(false); } }
  async function action(path: string, body: unknown, success = "Operación registrada.") {
    setBusy(true); setNotice("");
    try {
      const data = await adminRequest(path, body);
      const message = data.sent === false ? "No hay invitación elegible pendiente. No se envió ningún mensaje." : data.sent === true ? "Proveedor aceptó " + data.acceptedCount + " invitaciones. No implica entrega ni respuesta." : success;
      try { await load(); setError(false); setNotice(message); }
      catch { setError(true); setNotice(message + " No se pudieron actualizar los registros; usa Actualizar registros."); }
    }
    catch (e) { setError(true); setNotice(e instanceof Error ? e.message : "Operación no confirmada."); } finally { setBusy(false); }
  }
  function moderate() {
    if (!confirm) return; const { id, approve } = confirm; setConfirm(null);
    if (approve && !checked[id]) { setError(true); setNotice("Marca la revisión de privacidad antes de aprobar."); return; }
    void action("marketplace", { id, approve, ...(approve ? { privacyReviewed: true } : {}) }, approve ? "Oportunidad aprobada y publicada." : "Oportunidad rechazada.");
    setChecked(current => ({ ...current, [id]: false }));
  }
  function removeOpportunity() {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    setDeleteConfirm(null);
    void action("marketplace", { action: "delete", id, confirmId: id }, "Oportunidad eliminada. Se conservaron los pagos y el historial.");
  }
  function payment(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void action("express", { id, action: f.get("action"), reference: f.get("reference"), operator: f.get("operator"), amount: Number(f.get("amount")), currency: "dop", evidenceConfirmed: f.get("evidence") === "on" });
  }
  function linkOwner(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void action("marketplace", { action: "link_owner", id: f.get("worker"), owner: f.get("owner"), evidence: f.get("evidence"), operator: f.get("operator"), identityVerified: f.get("verified") === "on" });
  }
  const visible = reviews.filter(r => r.moderation_status === filter && (filter !== "pending" || r.status === "draft"));
  return <div className="moderation-dashboard"><div className="moderation-toolbar"><p>Revisión manual de publicaciones y cuentas. Ninguna oportunidad se publica sin aprobación.</p><button type="button" className="btn-secondary" disabled={busy} onClick={() => void refresh()}>Actualizar registros</button></div>
    {notice && <p className={"moderation-notice" + (error ? " moderation-notice--error" : "")} role={error ? "alert" : "status"}>{notice}</p>}
    {earlyClosures.length > 0 && <section className="moderation-section" aria-labelledby="featured-closures-title"><div className="moderation-section__heading"><div><p className="moderation-eyebrow">Pago destacado</p><h2 id="featured-closures-title">Cierres anticipados para revisión</h2></div><span>{earlyClosures.length} pendientes</span></div><p>Estas oportunidades ya no aparecen públicamente. Revisa cada cobro y su entrega en Stripe; no se emite un reembolso automático.</p><div className="moderation-list">{earlyClosures.map(order => <article className="moderation-report" key={order.id}><div><strong>Oportunidad #{order.opportunity_id.slice(0, 8)}</strong><span>Pago registrado el {date(order.paid_at)} · vigencia prevista hasta {date(order.featured_until)}</span><span>Orden #{order.id}</span></div></article>)}</div></section>}
    <section className="moderation-section" aria-labelledby="moderation-title"><div className="moderation-section__heading"><div><p className="moderation-eyebrow">01 / Publicaciones</p><h2 id="moderation-title">Moderación de oportunidades</h2></div><p>Revisa el alcance y la privacidad antes de publicar.</p></div>
      <div className="moderation-filters" role="group" aria-label="Filtrar por estado">{(["pending", "approved", "rejected"] as const).map(status => <button key={status} type="button" className={"moderation-filter" + (filter === status ? " moderation-filter--active" : "")} aria-pressed={filter === status} onClick={() => setFilter(status)}><span>{labels[status]}</span><strong>{counts[status]}</strong></button>)}</div>
      {visible.length === 0 ? <div className="moderation-empty">No hay oportunidades {labels[filter].toLowerCase()} en esta vista.</div> : <div className="moderation-list">{visible.map(r => <article className="moderation-card" key={r.id}>
        <div className="moderation-card__top"><span className={"moderation-state moderation-state--" + r.moderation_status}>{labels[r.moderation_status]}</span><span>#{r.id.slice(0, 8)}</span></div>
        <div className="moderation-card__intro"><div><p className="moderation-card__city">{r.city}</p><h3>{CATEGORIES.find(c => c.searchKey === r.category)?.label ?? r.category}</h3></div><p className="moderation-card__pay">{pay(r)}</p></div>
        <div className="moderation-card__body"><div className="moderation-card__description"><h4>Descripción del trabajo</h4><p>{r.scope}</p>{answers(r.specification, r.category).length > 0 && <dl>{answers(r.specification, r.category).map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}</div>
          <dl className="moderation-card__facts"><div><dt>Horario</dt><dd>{r.timing_note || (r.starts_at ? date(r.starts_at) : "Por acordar")}</dd></div><div><dt>Duración</dt><dd>{r.duration_note || (r.duration_minutes ? r.duration_minutes + " minutos" : "Por acordar")}</dd></div><div><dt>Enviada</dt><dd>{date(r.created_at)}</dd></div><div><dt>Vence</dt><dd>{date(r.expires_at)}</dd></div><div><dt>Estado</dt><dd>{({ draft: "Borrador", open: "Publicada", closed: "Cerrada", filled: "Cubierta", expired: "Vencida" } as Record<string, string>)[r.status] ?? r.status}</dd></div></dl></div>
        {r.moderation_status === "pending" && <div className="moderation-card__review"><label className="moderation-privacy"><input type="checkbox" checked={checked[r.id] ?? false} onChange={e => setChecked(current => ({ ...current, [r.id]: e.target.checked }))} /><span>Revisé todos los campos: términos completos, sin teléfonos, direcciones exactas, nombres privados ni datos sensibles.</span></label><div className="moderation-card__actions"><button type="button" className="btn-primary" disabled={busy || !checked[r.id]} onClick={() => setConfirm({ id: r.id, approve: true })}>Aprobar y publicar</button><button type="button" className="moderation-reject" disabled={busy} onClick={() => setConfirm({ id: r.id, approve: false })}>Rechazar</button></div></div>}
        <div className="moderation-card__actions"><button type="button" className="moderation-reject" disabled={busy} onClick={() => setDeleteConfirm(r)} aria-label={`Eliminar oportunidad ${r.id}`}>Eliminar</button></div>
      </article>)}</div>}{counts[filter] > 50 && <p className="moderation-limit">Mostrando 50 de {counts[filter]} registros. Las aprobadas y rechazadas más recientes aparecen primero.</p>}</section>
    <section className="moderation-section" aria-labelledby="accounts-title"><div className="moderation-section__heading"><div><p className="moderation-eyebrow">02 / Identidad</p><h2 id="accounts-title">Verificación de cuentas</h2></div></div><div className="moderation-form-panel"><p>Solo tras verificar al titular por el procedimiento aprobado. El correo por sí solo, un teléfono y los enlaces antiguos no prueban propiedad. No reemplaza titulares ni activa perfiles.</p><form className="request-fields" onSubmit={linkOwner}><label>ID del perfil<input name="worker" required /></label><label>ID de cuenta verificada<input name="owner" required /></label><label>Referencia de evidencia privada<input name="evidence" pattern="[A-Za-z0-9:_-]{5,160}" required /></label><label>Responsable de verificación<input name="operator" pattern="[A-Za-z0-9_-]{3,60}" required /></label><label className="moderation-privacy"><input type="checkbox" name="verified" required /> Verifiqué al titular con evidencia independiente y su consentimiento para vincular esta cuenta.</label><button className="btn-primary" disabled={busy}>Vincular sin activar</button></form></div></section>
    <section className="moderation-section" aria-labelledby="reports-title"><div className="moderation-section__heading"><div><p className="moderation-eyebrow">03 / Seguridad</p><h2 id="reports-title">Reportes</h2></div><span>{reports.length} pendientes</span></div>{reports.length === 0 ? <div className="moderation-empty">No hay reportes pendientes.</div> : <div className="moderation-list">{reports.map(r => <article className="moderation-report" key={r.id}><div><strong>{({ spam: "Spam", misleading: "Información engañosa", unsafe: "Seguridad", privacy: "Privacidad", other: "Otro motivo" } as Record<string, string>)[r.reason] ?? r.reason}</strong><span>Reportado el {date(r.created_at)}</span><a href={"/oportunidades?id=" + encodeURIComponent(r.opportunity_id)} target="_blank" rel="noreferrer">Revisar oportunidad ↗</a></div><div className="moderation-report__actions"><button type="button" className="moderation-reject" disabled={busy} onClick={() => void action("marketplace", { action: "resolve_report", id: r.id, remove: true }, "Publicación retirada y reporte resuelto.")}>Retirar publicación y resolver</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => void action("marketplace", { action: "resolve_report", id: r.id, remove: false }, "Reporte resuelto sin retirar.")}>Resolver sin retirar</button></div></article>)}</div>}</section>
    {expressAvailable && <section className="moderation-section" aria-labelledby="payments-title"><div className="moderation-section__heading"><div><p className="moderation-eyebrow">04 / Operaciones</p><h2 id="payments-title">Pagos y cumplimiento</h2></div></div><p>Verifica el recibo en el proveedor; una captura aportada por el cliente no demuestra pago. Registrar reembolso exige haberlo completado externamente. No se inicia aquí un movimiento bancario.</p>
    {orders.map(o => <article key={o.id}><h3>{o.status} · {o.channel}</h3><p>RD${(o.amount / 100).toFixed(2)} · {o.reference}</p><div className="request-actions"><button disabled={busy} onClick={() => action("express", { id: o.id, action: "reconcile" })}>Reconciliar plazo y respuestas</button><button disabled={busy || o.status !== "paid"} onClick={() => action("express", { id: o.id, action: "dispatch" })}>Enviar invitaciones consentidas</button></div>
      <form className="request-fields" onSubmit={e => payment(e, o.id)}><label>Operación<select name="action"><option value="transfer_paid">Confirmar transferencia recibida</option><option value="refund_recorded">Registrar reembolso completado</option></select></label><label>Responsable<input name="operator" pattern="[A-Za-z0-9_-]{3,60}" required /></label><label>Referencia externa única<input name="reference" pattern="[A-Za-z0-9:_-]{5,160}" required /></label><label>Monto recibido en centavos DOP<input name="amount" type="number" min="29900" max="29900" defaultValue="29900" required /></label><label><input name="evidence" type="checkbox" required /> Verifiqué la evidencia externa y el monto completo.</label><button disabled={busy}>Registrar evidencia</button></form>
    </article>)}</section>}
    {confirm && <div className="moderation-modal-backdrop"><div role="dialog" aria-modal="true" aria-labelledby="moderation-confirm-title" aria-describedby="moderation-confirm-text" onKeyDown={e => { if (e.key === "Escape") setConfirm(null); }} className="moderation-modal"><p className="moderation-eyebrow">Confirmar decisión</p><h2 id="moderation-confirm-title">{confirm.approve ? "¿Publicar esta oportunidad?" : "¿Rechazar esta oportunidad?"}</h2><p id="moderation-confirm-text">{confirm.approve ? "La oportunidad quedará visible en el mercado después de confirmar. Asegúrate de que no incluya datos privados." : "La oportunidad se cerrará y no aparecerá en el mercado."}</p><div className="moderation-card__actions"><button type="button" className={confirm.approve ? "btn-primary" : "moderation-reject"} onClick={moderate}>{confirm.approve ? "Sí, aprobar y publicar" : "Sí, rechazar"}</button><button type="button" className="btn-secondary" autoFocus onClick={() => setConfirm(null)}>Cancelar</button></div></div></div>}
    {deleteConfirm && <div className="moderation-modal-backdrop"><div role="dialog" aria-modal="true" aria-labelledby="delete-opportunity-title" aria-describedby="delete-opportunity-text" onKeyDown={e => { if (e.key === "Escape") setDeleteConfirm(null); }} className="moderation-modal"><p className="moderation-eyebrow">Confirmar eliminación</p><h2 id="delete-opportunity-title">¿Eliminar esta oportunidad?</h2><p id="delete-opportunity-text">{CATEGORIES.find(c => c.searchKey === deleteConfirm.category)?.label ?? deleteConfirm.category} en {deleteConfirm.city} · #{deleteConfirm.id}. Dejará de aparecer y no podrá comprarse ni destacarse. Los pagos y el historial se conservarán.</p><div className="moderation-card__actions"><button type="button" className="moderation-reject" onClick={removeOpportunity}>Sí, eliminar</button><button type="button" className="btn-secondary" autoFocus onClick={() => setDeleteConfirm(null)}>Cancelar</button></div></div></div>}
  </div>;
}
