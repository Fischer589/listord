"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { requestSummary, type RequestDraft } from "@/lib/request-specification";
import { isValidWhatsAppUrl } from "@/lib/whatsapp";
import { featuredSessionExpiresAt } from "@/lib/marketplace-featured";
import { marketplaceRequest } from "./marketplace-session";
import { ExpressOrders } from "./express-orders";
import { ContactPaywall } from "./contact-paywall";
import { rememberSelectedWorker } from "@/lib/free-contact";

type Opportunity = { id: string; category: string; city: string; specification: RequestDraft; status: string; moderation_status: string; expires_at: string };
type Applicant = { opportunity_id: string; worker_id: string; full_name: string; city: string | null; skills: string[] | null; created_at: string };
type Owned = { opportunity_id: string; marketplace_opportunities: Opportunity };
type Featured = { opportunity_id: string; status: string; featured_until: string | null };

function label(o: Opportunity) {
  if (o.status === "draft") return o.moderation_status === "rejected" ? "No aprobada" : "En revisión";
  if (o.status === "open" && Date.parse(o.expires_at) <= Date.now()) return "Vencida";
  return ({ open: "Publicada", closed: "Cerrada", filled: "Cubierta", expired: "Vencida" } as Record<string, string>)[o.status] ?? "No disponible";
}

export function EmployerOpportunities({ token, expressAvailable = false, featuredReturn = false, featuredCanceled = false, featuredOpportunityId = null }: { token: string; expressAvailable?: boolean; featuredReturn?: boolean; featuredCanceled?: boolean; featuredOpportunityId?: string | null }) {
  const router = useRouter();
  const [owned, setOwned] = useState<Opportunity[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [featuredCheckoutAvailable, setFeaturedCheckoutAvailable] = useState(false);
  const [featuredReturnTimedOut, setFeaturedReturnTimedOut] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [paywallWorker, setPaywallWorker] = useState<string | null>(null);
  const load = useCallback(async () => {
    const data = await marketplaceRequest(token);
    setOwned((data.owned as Owned[]).map(row => row.marketplace_opportunities));
    setApplicants(data.applicants ?? []);
    setFeatured(data.featured ?? []);
    setFeaturedCheckoutAvailable(data.featuredCheckoutAvailable === true);
  }, [token]);
  useEffect(() => {
    let alive = true;
    marketplaceRequest(token).then(data => {
      if (alive) { setOwned((data.owned as Owned[]).map(row => row.marketplace_opportunities)); setApplicants(data.applicants ?? []); setFeatured(data.featured ?? []); setFeaturedCheckoutAvailable(data.featuredCheckoutAvailable === true); }
    }).catch(error => { if (alive) setNotice(error.message); });
    return () => { alive = false; };
  }, [token]);
  const returnedFeatured = featured.find(order => order.opportunity_id === featuredOpportunityId && order.status === "paid" && order.featured_until && Date.parse(order.featured_until) > Date.now());
  useEffect(() => {
    if (!featuredReturn || !featuredOpportunityId || returnedFeatured) return;
    const interval = window.setInterval(() => { void load().catch(() => {}); }, 4000);
    const stop = window.setTimeout(() => { window.clearInterval(interval); setFeaturedReturnTimedOut(true); }, 60_000);
    return () => { window.clearInterval(interval); window.clearTimeout(stop); };
  }, [featuredReturn, featuredOpportunityId, returnedFeatured, load]);
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
    rememberSelectedWorker(applicant.worker_id);
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/marketplace/contacts", { method: "POST", cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: o.id, workerId: applicant.worker_id }), signal: AbortSignal.timeout(12000) });
      if (response.status === 401 || response.status === 402) { setPaywallWorker(applicant.worker_id); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se confirmó el contacto autorizado.");
      const result = data.contacts?.find((candidate: { workerId: string }) => candidate.workerId === applicant.worker_id);
      if (!result?.url || !isValidWhatsAppUrl(result.url)) throw new Error("No se confirmó el contacto autorizado.");
      window.location.assign(result.url);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo preparar el contacto."); }
    finally { setBusy(false); }
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
    {featuredReturn && <p role="status" className="workspace-feedback">{returnedFeatured
      ? `Pago confirmado. Tu oportunidad está destacada hasta ${new Date(returnedFeatured.featured_until!).toLocaleDateString("es-DO")}.`
      : featuredReturnTimedOut ? "La confirmación sigue pendiente. Revisa el estado más tarde; no vuelvas a pagar mientras Stripe procesa el cobro."
      : "Esperando la confirmación firmada del pago destacado. El regreso desde Stripe no activa la ubicación destacada."}</p>}
    {featuredCanceled && <p role="status" className="workspace-feedback">Volviste de Stripe. La oportunidad solo se destaca si Stripe confirma el cobro; puedes revisar su estado aquí.</p>}
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
        {featuredCheckoutAvailable && o.status === "open" && o.moderation_status === "approved" && !activeFeatured && !featuredSessionExpiresAt(o.expires_at) && <p className="employer-opportunities__note">Esta publicación vence demasiado pronto para ofrecer siete días destacados completos.</p>}
        {featuredCheckoutAvailable && o.status === "open" && o.moderation_status === "approved" && !!featuredSessionExpiresAt(o.expires_at) && !activeFeatured && !(featuredReturn && featuredOpportunityId === o.id && pendingFeatured) &&
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void purchaseFeatured(o)}>{pendingFeatured ? "Continuar pago destacado" : "Destacar por RD$149 · 7 días"}</button>}
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
  </section>{expressAvailable && <div className="workspace-panel"><ExpressOrders token={token} opportunities={owned} /></div>}{paywallWorker && <ContactPaywall workerId={paywallWorker} onClose={() => setPaywallWorker(null)} />}</>;
}
