"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { requestSummary, type RequestDraft } from "@/lib/request-specification";
import { isValidWhatsAppUrl } from "@/lib/whatsapp";
import { marketplaceRequest } from "./marketplace-session";
import { ExpressOrders } from "./express-orders";

type Opportunity = { id: string; category: string; city: string; specification: RequestDraft; status: string; moderation_status: string; expires_at: string };
type Applicant = { opportunity_id: string; worker_id: string; full_name: string; city: string | null; skills: string[] | null; created_at: string };
type Owned = { opportunity_id: string; marketplace_opportunities: Opportunity };
type Featured = { opportunity_id: string; status: string; featured_until: string | null };

function label(o: Opportunity) {
  if (o.status === "draft") return o.moderation_status === "rejected" ? "No aprobada" : "En revisión";
  if (o.status === "open" && Date.parse(o.expires_at) <= Date.now()) return "Vencida";
  return ({ open: "Publicada", closed: "Cerrada", filled: "Cubierta", expired: "Vencida" } as Record<string, string>)[o.status] ?? "No disponible";
}

export function EmployerOpportunities({ token, expressAvailable = false }: { token: string; expressAvailable?: boolean }) {
  const router = useRouter();
  const [owned, setOwned] = useState<Opportunity[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [featuredCheckoutAvailable, setFeaturedCheckoutAvailable] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const data = await marketplaceRequest(token);
    setOwned((data.owned as Owned[]).map(row => row.marketplace_opportunities));
    setApplicants(data.applicants ?? []);
    setFeatured(data.featured ?? []);
    setFeaturedCheckoutAvailable(data.featuredCheckoutAvailable === true);
  }
  useEffect(() => {
    let alive = true;
    marketplaceRequest(token).then(data => {
      if (alive) { setOwned((data.owned as Owned[]).map(row => row.marketplace_opportunities)); setApplicants(data.applicants ?? []); setFeatured(data.featured ?? []); setFeaturedCheckoutAvailable(data.featuredCheckoutAvailable === true); }
    }).catch(error => { if (alive) setNotice(error.message); });
    return () => { alive = false; };
  }, [token]);
  async function close(o: Opportunity) {
    setBusy(true); setNotice("");
    try { await marketplaceRequest(token, { action: "transition", id: o.id, status: "closed" }); await load(); setNotice("Oportunidad retirada. Ya no acepta respuestas."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se confirmó el cambio."); }
    finally { setBusy(false); }
  }
  async function fill(o: Opportunity) {
    setBusy(true); setNotice("");
    try { await marketplaceRequest(token, { action: "transition", id: o.id, status: "filled" }); await load(); setNotice("Oportunidad marcada como cubierta. Ya no acepta respuestas."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se confirmó el cambio."); }
    finally { setBusy(false); }
  }
  async function edit(o: Opportunity) {
    setBusy(true); setNotice("");
    try {
      sessionStorage.setItem("listord-reuse-request-v1", JSON.stringify(o.specification));
      if (o.status === "draft" || o.status === "open") await marketplaceRequest(token, { action: "transition", id: o.id, status: "closed" });
      router.push("/solicitar");
    } catch (error) {
      sessionStorage.removeItem("listord-reuse-request-v1");
      setNotice(error instanceof Error ? error.message : "No se pudo abrir el borrador."); setBusy(false);
    }
  }
  async function contact(o: Opportunity, applicant: Applicant) {
    setBusy(true); setNotice("");
    try {
      const data = await marketplaceRequest(token, { id: o.id, workerId: applicant.worker_id }, "/api/marketplace/contacts");
      const result = data.contacts?.find((candidate: { workerId: string }) => candidate.workerId === applicant.worker_id);
      if (!result?.url || !isValidWhatsAppUrl(result.url)) throw new Error("No se confirmó el contacto autorizado.");
      window.location.assign(result.url);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo preparar el contacto."); setBusy(false); }
  }
  async function purchaseFeatured(o: Opportunity) {
    setBusy(true); setNotice("");
    try {
      const data = await marketplaceRequest(token, { opportunityId: o.id }, "/api/stripe/featured-opportunity-checkout");
      if (typeof data.url !== "string" || !data.url.startsWith("https://checkout.stripe.com/")) throw new Error("No se confirmó el enlace de pago.");
      window.location.assign(data.url);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo iniciar el pago."); setBusy(false); }
  }
  return <><section className="workspace-panel employer-opportunities" aria-labelledby="employer-opportunities-title">
    <div className="workspace-panel__head"><div><p className="workspace-eyebrow">Marketplace gratuito</p><h2 id="employer-opportunities-title">Mis oportunidades</h2></div><span className="workspace-count">{owned.length}</span></div>
    <p className="workspace-panel__intro">Publicar y revisar respuestas es gratis. Tus solicitudes privadas y notas del espacio de empleador nunca se publican automáticamente.</p>
    <Link className="workspace-text-link" href="/solicitar">Crear oportunidad</Link>
    {owned.length === 0 && <p className="workspace-empty">Aún no has enviado oportunidades a revisión.</p>}
    <div className="workspace-stack">{owned.map(o => {
      const interested = applicants.filter(applicant => applicant.opportunity_id === o.id);
      const activeFeatured = featured.find(order => order.opportunity_id === o.id && order.status === "paid" && order.featured_until && Date.parse(order.featured_until) > Date.now());
      const pendingFeatured = featured.some(order => order.opportunity_id === o.id && order.status === "pending");
      return <article key={o.id} className="workspace-item">
        <div className="workspace-item__head"><h3>{CATEGORIES.find(c => c.searchKey === o.category)?.label ?? o.category} · {o.city}</h3><span className="workspace-state">{label(o)}</span></div>
        <p className="workspace-item__details">{requestSummary(o.specification)}</p>
        <p>{interested.length} {interested.length === 1 ? "trabajador interesado" : "trabajadores interesados"}. Una respuesta no confirma disponibilidad ni contratación.</p>
        {activeFeatured && <p className="employer-opportunities__featured">Destacada hasta {new Date(activeFeatured.featured_until!).toLocaleDateString("es-DO")}</p>}
        {featuredCheckoutAvailable && o.status === "open" && o.moderation_status === "approved" && Date.parse(o.expires_at) > Date.now() && !activeFeatured &&
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void purchaseFeatured(o)}>{pendingFeatured ? "Continuar pago destacado" : "Destacar 7 días · RD$149"}</button>}
        {interested.length > 0 && <ul className="employer-opportunities__applicants">{interested.map(applicant => <li key={applicant.worker_id}>
          <div><strong>{applicant.full_name}</strong><span>{applicant.city || "República Dominicana"}{applicant.skills?.length ? ` · ${applicant.skills.slice(0, 3).join(", ")}` : ""}</span></div>
          {o.status === "open" && Date.parse(o.expires_at) > Date.now() && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void contact(o, applicant)}>Elegir y contactar</button>}
        </li>)}</ul>}
        <div className="workspace-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => void edit(o)}>Editar y reenviar a revisión</button>
          {(o.status === "draft" || o.status === "open") && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void close(o)}>{o.status === "open" ? "Cerrar oportunidad" : "Retirar de revisión"}</button>}
          {o.status === "open" && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void fill(o)}>Marcar como cubierta</button>}</div>
        <p className="employer-opportunities__note">Editar cierra esta versión y abre una copia privada. Solo la nueva versión aprobada podrá publicarse.</p>
      </article>;
    })}</div>
    {notice && <p role="status" className="workspace-feedback">{notice}</p>}
  </section>{expressAvailable && <div className="workspace-panel"><ExpressOrders token={token} opportunities={owned} /></div>}</>;
}
