"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { MarketplaceSession } from "./marketplace-session";
import { isValidWhatsAppUrl } from "@/lib/whatsapp";
import { EmployerOpportunities } from "./employer-opportunities";

type Candidate = { id: string; full_name: string; city: string | null; skills: string[] | null; savedAt: string };
type StaffingRequest = { id: string; title: string; details: string; status: "open" | "closed"; created_at: string };
type Contact = { id: string; worker_id: string; worker_name: string | null; request_id: string | null; created_at: string };
type Workspace = { active: boolean; accessUntil: string | null; candidates: Candidate[]; requests: StaffingRequest[]; contacts: Contact[] };

async function api(token: string, body?: Record<string, unknown>, path = "/api/employer-workspace") {
  const response = await fetch(path, { method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Intenta de nuevo.");
  return data;
}

function WorkspaceAccount({ token, selectedWorkerId, returned, canceled }: { token: string; selectedWorkerId: string | null; returned: boolean; canceled: boolean }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [requestId, setRequestId] = useState("");
  const [workerToSave, setWorkerToSave] = useState(selectedWorkerId);
  useEffect(() => {
    try {
      if (selectedWorkerId) sessionStorage.setItem("listord-workspace-selected-worker", selectedWorkerId);
      else if (returned) setWorkerToSave(sessionStorage.getItem("listord-workspace-selected-worker"));
    } catch { /* Selection is optional when browser storage is unavailable. */ }
  }, [selectedWorkerId, returned]);
  const load = useCallback(async () => {
    try { setData(await api(token) as Workspace); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos cargar tu espacio."); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!returned || data?.active) return;
    const poll = window.setInterval(() => { void load(); }, 4000);
    const stop = window.setTimeout(() => window.clearInterval(poll), 60_000);
    return () => { window.clearInterval(poll); window.clearTimeout(stop); };
  }, [returned, data?.active, load]);
  async function act(body: Record<string, unknown>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await api(token, body); await load(); setNotice(message); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos guardar."); return false; }
    finally { setBusy(false); }
  }
  async function contact(workerId: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api(token, { action: "prepare_contact", workerId, requestId: requestId || null });
      if (typeof result.url !== "string" || !isValidWhatsAppUrl(result.url)) throw new Error("No se pudo preparar WhatsApp.");
      await load();
      window.location.assign(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo abrir WhatsApp."); }
    finally { setBusy(false); }
  }
  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    if (await act({ action: "add_request", title, details }, "Solicitud guardada en tu espacio privado.")) {
      setTitle(""); setDetails("");
    }
  }
  if (!data) return <p role="status" className="workspace-feedback">{error || "Cargando tu espacio..."}</p>;
  if (!data.active) return <section className="workspace-offer" aria-labelledby="workspace-offer-title">
    <div className="workspace-offer__copy">
      <p className="workspace-eyebrow">Pase de Empleador · 30 días</p>
      <h2 id="workspace-offer-title">Tu próximo equipo, en orden</h2>
      <p>Guarda candidatos, organiza solicitudes de personal, registra intentos de contacto y vuelve a tus listas.</p>
      <p className="workspace-offer__fineprint">Explorar perfiles y contactar por WhatsApp sigue siendo gratis. Confirma disponibilidad, respuesta y condiciones directamente con cada persona.</p>
    </div>
    <div className="workspace-offer__purchase">
      <p className="workspace-offer__price">RD$299 <span>/ 30 días</span></p>
      <p>Pago único. Sin renovación automática.</p>
      <div className="workspace-actions">
        <Link className="btn-primary" href="/empleadores/pago">Comprar 30 días · RD$299</Link>
        <button type="button" className="btn-secondary" onClick={() => void load()}>Actualizar estado</button>
      </div>
      {returned && <p role="status" className="workspace-feedback">Esperando confirmación del pago por Stripe. El regreso desde Checkout no activa el acceso.</p>}
      {canceled && <p role="status" className="workspace-feedback">Volviste del pago. Tu pase solo se activa cuando Stripe confirme el cobro.</p>}
      {error && <p role="alert" className="workspace-feedback workspace-feedback--error">{error}</p>}
    </div>
  </section>;
  return <section className="workspace-dashboard" aria-label="Espacio de empleador">
    <header className="workspace-pass" role="status">
      <div>
        <p className="workspace-eyebrow">Pase de Empleador · 30 días</p>
        <h2>Tu pase está activo</h2>
        <p>El contacto con trabajadores sigue siendo gratis. Confirma su disponibilidad directamente.</p>
      </div>
      <div className="workspace-pass__date"><span>Válido hasta</span><strong>{new Date(data.accessUntil!).toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" })}</strong></div>
    </header>
    {workerToSave && <aside className="workspace-selected" aria-label="Perfil seleccionado">
      <div><p className="workspace-eyebrow">Desde el directorio</p><p>Perfil seleccionado para tu lista de candidatos.</p></div>
      <button type="button" className="btn-primary" disabled={busy} onClick={() => void act({ action: "save_candidate", workerId: workerToSave }, "Candidato guardado.").then(saved => {
        if (saved) { setWorkerToSave(null); try { sessionStorage.removeItem("listord-workspace-selected-worker"); } catch { /* Optional storage. */ } }
      })}>Guardar candidato</button>
    </aside>}
    <div className="workspace-columns">
      <section className="workspace-panel" aria-labelledby="workspace-candidates-title">
        <div className="workspace-panel__head"><div><p className="workspace-eyebrow">Tu lista</p><h2 id="workspace-candidates-title">Candidatos guardados</h2></div><span className="workspace-count">{data.candidates.length}</span></div>
        <p className="workspace-panel__intro">Perfiles revisados; confirma disponibilidad y condiciones directamente.</p>
        <Link className="workspace-text-link" href="/">Explorar trabajadores</Link>
        {data.candidates.length === 0 && <p className="workspace-empty">Aún no guardaste candidatos.</p>}
        <div className="workspace-stack">{data.candidates.map(worker => <article key={worker.id} className="workspace-item">
          <h3>{worker.full_name}</h3><p>{worker.city || "República Dominicana"} · {(worker.skills || []).slice(0, 3).join(", ")}</p>
          <div className="workspace-actions"><Link className="btn-secondary" href={`/trabajador/${encodeURIComponent(worker.id)}`}>Ver perfil</Link>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void contact(worker.id)}>Preparar WhatsApp y registrar intento</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void act({ action: "remove_candidate", workerId: worker.id }, "Candidato quitado.")}>Quitar de lista</button></div>
        </article>)}</div>
      </section>
      <section className="workspace-panel" aria-labelledby="workspace-requests-title">
        <div className="workspace-panel__head"><div><p className="workspace-eyebrow">Planificación</p><h2 id="workspace-requests-title">Solicitudes privadas</h2></div><span className="workspace-count">{data.requests.length}</span></div>
        <p className="workspace-panel__intro">Organiza lo que necesitas. Estas notas no se publican ni se envían a trabajadores.</p>
        <form onSubmit={submitRequest} className="workspace-form">
          <label>Título<input required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Ayuda con limpieza semanal" /></label>
          <label>Detalles<textarea maxLength={1200} value={details} onChange={e => setDetails(e.target.value)} placeholder="Tareas, horario y zona general" /></label>
          <button type="submit" className="btn-primary" disabled={busy}>Guardar solicitud</button>
        </form>
        {data.requests.length === 0 && <p className="workspace-empty">Aún no guardaste solicitudes.</p>}
        <div className="workspace-stack">{data.requests.map(item => <article key={item.id} className="workspace-item">
          <div className="workspace-item__head"><h3>{item.title}</h3><span className="workspace-state">{item.status === "open" ? "Abierta" : "Cerrada"}</span></div>
          <p className="workspace-item__details">{item.details}</p>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void act({ action: "set_request_status", requestId: item.id, status: item.status === "open" ? "closed" : "open" }, "Estado actualizado.")}>{item.status === "open" ? "Cerrar" : "Reabrir"}</button>
        </article>)}</div>
      </section>
    </div>
    <section className="workspace-panel" aria-labelledby="workspace-contacts-title">
      <div className="workspace-panel__head"><div><p className="workspace-eyebrow">Seguimiento</p><h2 id="workspace-contacts-title">Registro de contacto</h2></div><span className="workspace-count">{data.contacts.length}</span></div>
      <p className="workspace-panel__intro">Registramos cuándo se preparó un enlace de WhatsApp. No podemos confirmar si enviaste el mensaje o recibiste respuesta.</p>
      <label className="workspace-select-label">Solicitud para el próximo contacto<select value={requestId} onChange={e => setRequestId(e.target.value)}><option value="">Sin solicitud asociada</option>{data.requests.filter(item => item.status === "open").map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {data.contacts.length === 0 ? <p className="workspace-empty">Aún no hay intentos registrados.</p> : <ul className="workspace-contact-list">{data.contacts.map(item => <li key={item.id}><span>{new Date(item.created_at).toLocaleString("es-DO")}</span><strong>{item.worker_name || "Perfil no disponible"}</strong><span>{data.requests.find(r => r.id === item.request_id)?.title || "Sin solicitud"}</span></li>)}</ul>}
    </section>
    {notice && <p role="status" className="workspace-feedback">{notice}</p>}{error && <p role="alert" className="workspace-feedback workspace-feedback--error">{error}</p>}
  </section>;
}

export function EmployerWorkspace({ selectedWorkerId, returned, canceled, opportunitiesEnabled = false, expressAvailable = false }: { selectedWorkerId: string | null; returned: boolean; canceled: boolean; opportunitiesEnabled?: boolean; expressAvailable?: boolean }) {
  return <MarketplaceSession emailRedirectPath="/empleadores/mi-cuenta" description="Verifica tu correo para comprar y usar tu espacio privado de empleador. La exploración y el contacto directo son gratis.">
    {token => <><WorkspaceAccount token={token} selectedWorkerId={selectedWorkerId} returned={returned} canceled={canceled} />
      {opportunitiesEnabled && <EmployerOpportunities token={token} expressAvailable={expressAvailable} />}</>}
  </MarketplaceSession>;
}
