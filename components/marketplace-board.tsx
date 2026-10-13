"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { requestSummary, type RequestDraft } from "@/lib/request-specification";
import { MarketplaceSession, marketplaceRequest } from "./marketplace-session";

type Opportunity = {
  id: string; category: string; city: string; scope: string; specification: RequestDraft;
  timing_note: string | null; duration_note: string | null; compensation_kind: string;
  compensation_min: number | null; compensation_unit: string | null; expires_at: string;
};
type Worker = { id: string; full_name: string };
type Decision = { opportunity_id: string; worker_id: string; decision: string; marketplace_opportunities?: Opportunity };
const units: Record<string, string> = { hour: "hora", day: "día", week: "semana", month: "mes", task: "trabajo" };

function compensation(o: Opportunity) {
  if (o.compensation_kind === "negotiable" || o.compensation_min == null) return "Pago por acordar";
  const amount = Number(o.compensation_min).toLocaleString("es-DO", { maximumFractionDigits: 2 });
  return `${o.compensation_kind === "budget" ? "Presupuesto" : "Pago"}: RD$${amount}${o.compensation_unit ? ` por ${units[o.compensation_unit] ?? o.compensation_unit}` : ""}`;
}

export function MarketplaceBoard() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [notice, setNotice] = useState("Cargando oportunidades…");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [selected, setSelected] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const id = new URLSearchParams(window.location.search).get("id");
    fetch(`/api/marketplace${id ? `?id=${encodeURIComponent(id)}` : ""}`, { cache: "no-store", signal: abort.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { setItems(data.opportunities); setNotice(data.opportunities.length ? `Mostrando ${data.opportunities.length} oportunidades recientes` : "No hay oportunidades abiertas por ahora."); })
      .catch(() => { if (!abort.signal.aborted) setNotice("No se pudieron cargar las oportunidades. Recarga para reintentar."); });
    return () => abort.abort();
  }, []);
  const visible = items.filter(o => (!category || o.category === category) && o.city.toLocaleLowerCase("es").includes(city.trim().toLocaleLowerCase("es")));
  function choose(id: string) {
    setSelected(id);
    const target = document.getElementById("participar");
    target?.focus();
    target?.scrollIntoView({ block: "start" });
  }
  return <>
    <div className="opportunity-intro"><p>Trabajos publicados tras revisión. Explora gratis y confirma los términos directamente con el empleador antes de aceptar.</p>
      <div className="opportunity-intro__links"><Link href="/solicitar">Crear una oportunidad</Link><Link href="/empleadores/mi-cuenta">Mis publicaciones</Link></div>
    </div>
    <div className="opportunity-filters"><label>Servicio<select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todos los servicios</option>{CATEGORIES.map(c => <option key={c.searchKey} value={c.searchKey}>{c.label}</option>)}</select></label>
      <label>Ciudad<input maxLength={100} value={city} onChange={event => setCity(event.target.value)} placeholder="Todas las ciudades" /></label></div>
    <p role="status" className="opportunity-count">{notice}</p>
    {items.length > 0 && visible.length === 0 && <p className="opportunity-empty">No hay oportunidades con estos filtros.</p>}
    <div className="opportunity-grid">{visible.map(o => <article key={o.id} className="opportunity-card">
      <div className="opportunity-card__top"><span className="opportunity-card__badge">Oportunidad abierta</span><span>{o.city}</span></div>
      <h2>{CATEGORIES.find(c => c.searchKey === o.category)?.label ?? o.category}</h2>
      <p className="opportunity-card__pay">{compensation(o)}</p>
      {o.timing_note && <p><strong>Horario:</strong> {o.timing_note}</p>}
      {o.duration_note && <p><strong>Duración:</strong> {o.duration_note}</p>}
      <p className="opportunity-card__description">{requestSummary(o.specification)}</p>
      <div className="opportunity-card__bottom"><span>Hasta {new Date(o.expires_at).toLocaleDateString("es-DO")}</span>
        <button type="button" className="btn-primary" onClick={() => choose(o.id)}>Me interesa</button></div>
    </article>)}</div>
    <section id="participar" className="opportunity-participate" aria-label="Responder a oportunidades" tabIndex={-1}>
      <MarketplaceSession emailRedirectPath="/oportunidades" description="Verifica tu correo para expresar interés gratis. Necesitas un perfil de trabajador aprobado y vinculado a tu cuenta.">
        {token => <WorkerInterestPanel token={token} opportunities={visible} selected={selected} />}
      </MarketplaceSession>
    </section>
  </>;
}

function WorkerInterestPanel({ token, opportunities, selected }: { token: string; opportunities: Opportunity[]; selected: string }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [worker, setWorker] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const invitedWorker = new URLSearchParams(window.location.search).get("worker");
    marketplaceRequest(token).then(data => {
      if (!alive) return;
      const profiles = data.workers as Worker[];
      setWorkers(profiles); setDecisions(data.decisions ?? []);
      setWorker(invitedWorker && profiles.some(profile => profile.id === invitedWorker) ? invitedWorker : profiles.length === 1 ? profiles[0].id : "");
    }).catch(error => { if (alive) setNotice(error.message); });
    return () => { alive = false; };
  }, [token]);
  async function decide(id: string, decision: "interested" | "declined" | "withdrawn") {
    setBusy(true); setNotice("");
    try {
      await marketplaceRequest(token, { action: "decide", id, workerId: worker, decision });
      const latest = await marketplaceRequest(token);
      setDecisions(latest.decisions ?? []);
      setNotice(decision === "interested" ? "Interés enviado. El empleador puede elegir contactarte; esto no confirma una contratación." : decision === "declined" ? "Respuesta NO guardada." : "Retiraste tu interés.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se confirmó la respuesta."); }
    finally { setBusy(false); }
  }
  async function report(id: string) {
    setBusy(true); setNotice("");
    try { await marketplaceRequest(token, { action: "report", id, reason: "privacy" }); setNotice("Reporte enviado para revisión."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se confirmó el reporte."); }
    finally { setBusy(false); }
  }
  async function consent(agree: boolean) {
    setBusy(true); setNotice("");
    try { await marketplaceRequest(token, { action: "consent", workerId: worker, agree }); setNotice(agree ? "Consentimiento para invitaciones Express guardado." : "Consentimiento para invitaciones Express retirado."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se confirmó el consentimiento."); }
    finally { setBusy(false); }
  }
  return <div className="opportunity-interest"><div><p className="t-eyebrow">Para trabajadores</p><h2>Responde con tu perfil</h2>
    <p>Tu perfil aprobado identifica tu respuesta. Explorar y expresar interés siempre es gratis.</p></div>
    {workers.length ? <label>Mi perfil verificado<select value={worker} onChange={event => setWorker(event.target.value)}><option value="">Elige tu perfil</option>{workers.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></label>
      : <p>No hay un perfil aprobado vinculado a esta cuenta. <Link href="/trabajadores/registro">Registrar mi perfil</Link>. Si ya tienes uno, solicita la vinculación tras verificar tu identidad.</p>}
    {worker && <><p>Al expresar interés autorizas compartir tu WhatsApp con quien publicó la oportunidad. Puedes retirar la respuesta.</p>
      <div className="opportunity-interest__consent"><button type="button" className="btn-secondary" disabled={busy} onClick={() => void consent(true)}>Acepto recibir invitaciones Express por WhatsApp</button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void consent(false)}>Retirar consentimiento de invitaciones</button></div></>}
    {opportunities.map(o => {
      const interested = decisions.some(d => d.opportunity_id === o.id && d.worker_id === worker && d.decision === "interested");
      const declined = decisions.some(d => d.opportunity_id === o.id && d.worker_id === worker && d.decision === "declined");
      return <div key={o.id} className={selected === o.id ? "opportunity-interest__row opportunity-interest__row--selected" : "opportunity-interest__row"}>
        <div><strong>{CATEGORIES.find(c => c.searchKey === o.category)?.label ?? o.category} · {o.city}</strong><span>{interested ? "Interés enviado" : declined ? "Respuesta NO guardada" : "Aún no has respondido"}</span></div>
        <div className="opportunity-interest__actions"><button type="button" className={interested ? "btn-secondary" : "btn-primary"} disabled={busy || !worker} onClick={() => void decide(o.id, interested ? "withdrawn" : "interested")}>{interested ? "Retirar interés" : "Me interesa"}</button>
          {!interested && <button type="button" className="btn-secondary" disabled={busy || !worker || declined} onClick={() => void decide(o.id, "declined")}>No me interesa</button>}
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void report(o.id)}>Reportar datos privados</button></div>
      </div>;
    })}
    {worker && decisions.filter(d => d.worker_id === worker && d.decision === "interested" && !opportunities.some(o => o.id === d.opportunity_id)).map(d => <div key={d.opportunity_id} className="opportunity-interest__row">
      <div><strong>{d.marketplace_opportunities?.city ?? "Oportunidad anterior"}</strong><span>Interés enviado · oportunidad cerrada o fuera de este filtro</span></div>
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => void decide(d.opportunity_id, "withdrawn")}>Retirar interés</button>
    </div>)}
    {notice && <p role="status">{notice}</p>}
  </div>;
}
