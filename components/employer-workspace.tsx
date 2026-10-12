"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { MarketplaceSession } from "./marketplace-session";
import { isValidWhatsAppUrl } from "@/lib/whatsapp";

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

function WorkspaceAccount({ token, selectedWorkerId, returned }: { token: string; selectedWorkerId: string | null; returned: boolean }) {
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
  async function buy() {
    setBusy(true); setError("");
    try {
      const result = await api(token, {}, "/api/stripe/workspace-checkout");
      if (typeof result.url !== "string" || !result.url.startsWith("https://checkout.stripe.com/")) throw new Error("No se confirmó la página de pago.");
      window.location.assign(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos iniciar el pago."); setBusy(false); }
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
  if (!data) return <p role="status">{error || "Cargando tu espacio..."}</p>;
  if (!data.active) return <section className="rounded-2xl border bg-white p-6 shadow-soft">
    <h2 className="text-2xl font-black">Espacio para empleadores</h2>
    <p className="mt-3">RD$299 por 30 días, pago único, sin renovación automática. Guarda candidatos, organiza solicitudes de personal, registra intentos de contacto y vuelve a tus listas.</p>
    <p className="mt-2">Explorar perfiles y contactar por WhatsApp sigue siendo gratis. La disponibilidad, respuesta y contratación deben confirmarse directamente con cada persona.</p>
    {returned && <p role="status" className="mt-3">Esperando confirmación del pago por Stripe. El regreso desde Checkout no activa el acceso.</p>}
    <button type="button" className="btn-primary mt-5" disabled={busy} onClick={buy}>{busy ? "Preparando pago..." : "Comprar 30 días · RD$299"}</button>
    <button type="button" className="btn-secondary ml-3" onClick={() => void load()}>Actualizar estado</button>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
  </section>;
  return <section className="space-y-8">
    <p role="status">Tu espacio está activo hasta {new Date(data.accessUntil!).toLocaleDateString("es-DO")}. El contacto con trabajadores sigue siendo gratis.</p>
    {workerToSave && <div className="rounded-2xl border bg-white p-5"><p>Perfil seleccionado desde el directorio.</p>
      <button type="button" className="btn-primary mt-3" disabled={busy} onClick={() => void act({ action: "save_candidate", workerId: workerToSave }, "Candidato guardado.").then(saved => {
        if (saved) { setWorkerToSave(null); try { sessionStorage.removeItem("listord-workspace-selected-worker"); } catch { /* Optional storage. */ } }
      })}>Guardar candidato</button></div>}
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-black">Candidatos guardados</h2>
      <p className="text-sm">Perfiles revisados; confirma disponibilidad y condiciones directamente.</p>
      <Link className="btn-secondary mt-3 inline-block" href="/">Explorar trabajadores</Link>
      {data.candidates.length === 0 && <p className="mt-4">Aún no guardaste candidatos.</p>}
      <div className="mt-4 space-y-4">{data.candidates.map(worker => <article key={worker.id} className="rounded-xl border p-4">
        <h3 className="font-black">{worker.full_name}</h3><p>{worker.city || "República Dominicana"} · {(worker.skills || []).slice(0, 3).join(", ")}</p>
        <div className="mt-3 flex flex-wrap gap-3"><Link className="btn-secondary" href={`/trabajador/${encodeURIComponent(worker.id)}`}>Ver perfil</Link>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void contact(worker.id)}>Preparar WhatsApp y registrar intento</button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void act({ action: "remove_candidate", workerId: worker.id }, "Candidato quitado.")}>Quitar de lista</button></div>
      </article>)}</div>
    </section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-black">Solicitudes privadas</h2>
      <p className="text-sm">Organiza lo que necesitas. Estas notas no se publican ni se envían a trabajadores.</p>
      <form onSubmit={submitRequest} className="request-fields mt-4"><label>Título<input required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Ayuda con limpieza semanal" /></label>
        <label>Detalles<textarea maxLength={1200} value={details} onChange={e => setDetails(e.target.value)} placeholder="Tareas, horario y zona general" /></label>
        <button type="submit" className="btn-primary" disabled={busy}>Guardar solicitud</button></form>
      <div className="mt-4 space-y-3">{data.requests.map(item => <article key={item.id} className="rounded-xl border p-4"><h3 className="font-black">{item.title}</h3>
        <p className="whitespace-pre-wrap">{item.details}</p><p className="text-sm">{item.status === "open" ? "Abierta" : "Cerrada"}</p>
        <button type="button" className="btn-secondary mt-2" disabled={busy} onClick={() => void act({ action: "set_request_status", requestId: item.id, status: item.status === "open" ? "closed" : "open" }, "Estado actualizado.")}>{item.status === "open" ? "Cerrar" : "Reabrir"}</button></article>)}</div>
    </section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-black">Registro de contacto</h2>
      <label className="mt-3 block">Solicitud para el próximo contacto<select value={requestId} onChange={e => setRequestId(e.target.value)}><option value="">Sin solicitud asociada</option>{data.requests.filter(item => item.status === "open").map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <p className="mt-2 text-sm">Registramos cuándo se preparó un enlace de WhatsApp. No podemos confirmar si enviaste el mensaje o recibiste respuesta.</p>
      {data.contacts.length === 0 ? <p className="mt-3">Aún no hay intentos registrados.</p> : <ul className="mt-3 space-y-2">{data.contacts.map(item => <li key={item.id}>{new Date(item.created_at).toLocaleString("es-DO")} · {item.worker_name || "Perfil no disponible"} · {data.requests.find(r => r.id === item.request_id)?.title || "Sin solicitud"}</li>)}</ul>}
    </section>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
  </section>;
}

export function EmployerWorkspace({ selectedWorkerId, returned }: { selectedWorkerId: string | null; returned: boolean }) {
  return <MarketplaceSession emailRedirectPath="/empleadores/mi-cuenta" description="Verifica tu correo para comprar y usar tu espacio privado de empleador. La exploración y el contacto directo son gratis.">
    {token => <WorkspaceAccount token={token} selectedWorkerId={selectedWorkerId} returned={returned} />}
  </MarketplaceSession>;
}
