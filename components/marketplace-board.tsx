"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { requestSummary, type RequestDraft } from "@/lib/request-specification";
import { MarketplaceSession, marketplaceRequest } from "./marketplace-session";
import { ExpressOrders } from "./express-orders";

type Opportunity = { id: string; city: string; category: string; specification: RequestDraft; status: string; expires_at: string };
type Decision = { opportunity_id: string; worker_id: string; decision: string; marketplace_opportunities: Opportunity };
const decisionLabels: Record<string, string> = { interested: "SÍ, me interesa", declined: "NO, no me interesa", withdrawn: "Respuesta retirada" };
const statusLabel = (o: Opportunity) => o.status === "open" && Date.parse(o.expires_at) <= Date.now() ? "Vencida" : ({ draft: "En revisión", open: "Abierta", closed: "Cerrada", filled: "Cubierta", expired: "Vencida" }[o.status] ?? o.status);
type Worker = { id: string; full_name: string };
export function MarketplaceBoard({ expressAvailable }: { expressAvailable: boolean }) {
  const [items, setItems] = useState<Opportunity[]>([]); const [notice, setNotice] = useState("Cargando oportunidades…");
  const [category, setCategory] = useState(""); const [city, setCity] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const id = new URLSearchParams(window.location.search).get("id");
    fetch(`/api/marketplace${id ? `?id=${encodeURIComponent(id)}` : ""}`, { cache: "no-store", signal: abort.signal }).then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { setItems(data.opportunities); setNotice(data.opportunities.length ? "Se muestran hasta 50 oportunidades recientes." : "No hay oportunidades abiertas por ahora."); }).catch(() => { if (!abort.signal.aborted) setNotice("No se pudieron cargar las oportunidades. Recarga para reintentar."); });
    return () => abort.abort();
  }, []);
  const visible = items.filter(o => (!category || o.category === category) && o.city.toLocaleLowerCase("es").includes(city.trim().toLocaleLowerCase("es")));
  return <><p>Revisa tareas, pago, horario y requisitos antes de responder. SÍ expresa interés; no confirma una contratación.</p><Link href="/solicitar">Crear una solicitud</Link> · <Link href="/trabajadores/registro">Crear mi perfil de trabajador</Link>
    <div className="request-fields"><label>Filtrar por servicio<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Todos</option>{CATEGORIES.map(c => <option key={c.searchKey} value={c.searchKey}>{c.label}</option>)}</select></label><label>Filtrar por ciudad<input maxLength={100} value={city} onChange={e => setCity(e.target.value)} /></label></div>
    <p role="status">{notice}</p>{items.length > 0 && visible.length === 0 && <p>No hay oportunidades con estos filtros.</p>}{visible.map(o => <article key={o.id} className="request-preview"><h2>{CATEGORIES.find(c => c.searchKey === o.category)?.label} · {o.city}</h2><p style={{ whiteSpace: "pre-line" }}>{requestSummary(o.specification)}</p><p>Vence: {new Date(o.expires_at).toLocaleDateString("es-DO")}</p></article>)}
    <MarketplaceSession>{token => <ParticipantPanel token={token} opportunities={visible} expressAvailable={expressAvailable} />}</MarketplaceSession></>;
}
function ParticipantPanel({ token, opportunities, expressAvailable }: { token: string; opportunities: Opportunity[]; expressAvailable: boolean }) {
  const router = useRouter();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]); const [owned, setOwned] = useState<Opportunity[]>([]); const [worker, setWorker] = useState("");
  const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false); const [shortlist, setShortlist] = useState<{ name: string; workerId: string; url: string }[]>([]);
  function reuse(o: Opportunity) {
    try { sessionStorage.setItem("listord-reuse-request-v1", JSON.stringify(o.specification)); router.push("/solicitar"); }
    catch { setNotice("No se pudo abrir una copia. Puedes copiar los términos de tu solicitud."); }
  }
  useEffect(() => {
    let alive = true;
    const invitedWorker = new URLSearchParams(window.location.search).get("worker");
    marketplaceRequest(token).then(data => { if (alive) { setWorkers(data.workers); setDecisions(data.decisions ?? []); setOwned(data.owned.map((x: { marketplace_opportunities: Opportunity }) => x.marketplace_opportunities)); if (invitedWorker && data.workers.some((w: Worker) => w.id === invitedWorker)) setWorker(invitedWorker); } }).catch(e => { if (alive) setNotice(e.message); });
    return () => { alive = false; };
  }, [token]);
  async function act(body: unknown) {
    setBusy(true); setNotice(""); setShortlist([]);
    try { await marketplaceRequest(token, body); const latest = await marketplaceRequest(token); setDecisions(latest.decisions ?? []); setOwned(latest.owned.map((x: { marketplace_opportunities: Opportunity }) => x.marketplace_opportunities)); setNotice("Cambio guardado. Una respuesta no equivale a contratación."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "No se confirmó el cambio."); }
    finally { setBusy(false); }
  }
  async function contacts(id: string) {
    setBusy(true); setNotice(""); setShortlist([]);
    try { const data = await marketplaceRequest(token, { id, workerId: worker || undefined }, "/api/marketplace/contacts"); setShortlist(data.contacts); setNotice(data.contacts.length ? "Solo respuestas SÍ vigentes. No son contrataciones." : "Todavía no hay respuestas SÍ vigentes."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "No se pudieron cargar los contactos."); }
    finally { setBusy(false); }
  }
  return <section><h2>Mi participación</h2><p role="status">{notice}</p>{shortlist.map(c => <p key={c.workerId}><a href={c.url} target="_blank" rel="noreferrer">Contactar a {c.name} por WhatsApp</a></p>)}
    {workers.length ? <label>Mi perfil verificado<select value={worker} onChange={e => setWorker(e.target.value)}><option value="">Elige tu perfil</option>{workers.map(w => <option value={w.id} key={w.id}>{w.full_name}</option>)}</select></label> : <p>No hay un perfil de trabajador aprobado vinculado a esta cuenta. La recuperación requiere verificar al titular; un teléfono no demuestra propiedad.</p>}
    {worker && <p>Al responder SÍ autorizas compartir tu WhatsApp con quien publicó la solicitud. Puedes cambiar de opinión o retirar tu respuesta.</p>}{worker && <div className="request-actions"><button disabled={busy} onClick={() => act({ action: "consent", workerId: worker, agree: true })}>Acepto recibir invitaciones Express por WhatsApp</button><button disabled={busy} onClick={() => act({ action: "consent", workerId: worker, agree: false })}>Retirar consentimiento de invitaciones</button></div>}
    {opportunities.map(o => <section key={o.id}><h3>{o.city} · {CATEGORIES.find(c => c.searchKey === o.category)?.label}</h3><p style={{ whiteSpace: "pre-line" }}>{requestSummary(o.specification)}</p><div className="request-actions">{([['interested','SÍ, me interesa'],['declined','NO, no me interesa'],['withdrawn','Retirar mi respuesta']] as const).map(([decision,label]) => <button key={decision} disabled={!worker || busy} onClick={() => act({ action: "decide", id: o.id, workerId: worker, decision })}>{label}</button>)}<button disabled={busy} onClick={() => act({ action: "report", id: o.id, reason: "privacy" })}>Reportar datos privados</button><button disabled={busy} onClick={() => contacts(o.id)}>Abrir contacto autorizado</button></div></section>)}
    <h2>Mis respuestas</h2>{decisions.map(d => <article key={`${d.opportunity_id}:${d.worker_id}`}><h3>{d.marketplace_opportunities.city} · {statusLabel(d.marketplace_opportunities)}</h3><p>{decisionLabels[d.decision]}</p><button disabled={busy || d.decision === "withdrawn"} onClick={() => act({ action: "decide", id: d.opportunity_id, workerId: d.worker_id, decision: "withdrawn" })}>Retirar respuesta guardada</button></article>)}
    <h2>Mis solicitudes</h2>{owned.map(o => <section key={o.id}><h3>{o.city} · {statusLabel(o)}</h3><p style={{ whiteSpace: "pre-line" }}>{requestSummary(o.specification)}</p><div className="request-actions"><button disabled={busy} onClick={() => reuse(o)}>Reutilizar detalles</button><button disabled={busy} onClick={() => contacts(o.id)}>Ver respuestas SÍ</button><button disabled={busy || !["open","draft"].includes(o.status)} onClick={() => act({ action: "transition", id: o.id, status: "closed" })}>Cerrar solicitud</button><button disabled={busy || o.status !== "open"} onClick={() => act({ action: "transition", id: o.id, status: "filled" })}>Marcar como cubierta</button></div></section>)}
    {expressAvailable && <ExpressOrders token={token} opportunities={owned} />}
  </section>;
}
