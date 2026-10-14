"use client";
import Link from "next/link";
import { createPortal } from "react-dom";
import { rememberSelectedWorker } from "@/lib/free-contact";
import { publicWorkerText } from "@/lib/public-worker";
import { trackEvent } from "@/lib/analytics";

export function ContactPaywall({ workerId, occupation, city, onClose }: { workerId: string; occupation?: string | null; city?: string | null; onClose: () => void }) {
  const safeOccupation = publicWorkerText(occupation);
  const safeCity = publicWorkerText(city);
  const twoTier = process.env.NEXT_PUBLIC_DIRECT_CONTACT_ENABLED === "true";
  const select = (plan: "direct" | "workspace") => { rememberSelectedWorker(workerId); trackEvent("checkout_start", { plan, stage: "selected" }); };
  if (typeof document === "undefined") return null;
  return createPortal(<div className="contact-paywall-backdrop"><div role="dialog" aria-modal="true" aria-labelledby="contact-paywall-title" aria-describedby="contact-paywall-description" className={`contact-paywall${twoTier ? " contact-paywall--two-tier" : ""}`} onKeyDown={e => { if (e.key === "Escape") onClose(); }}>
    {(safeOccupation || safeCity) && <p className="contact-paywall__selection">Perfil seleccionado: {[safeOccupation, safeCity].filter(Boolean).join(" · ")}</p>}
    <h2 id="contact-paywall-title">{twoTier ? "¿Ya encontraste a quien necesitas?" : "¿Encontraste a la persona indicada?"}</h2>
    <p id="contact-paywall-description">{twoTier ? "Elige cómo quieres conectar con los trabajadores de ListoRD." : "Desbloquea el contacto directo con los trabajadores que te interesan y encuentra a quien necesitas."}</p>
    {twoTier ? <>
      <div className="contact-paywall__offers">
        <section className="contact-paywall__offer" aria-labelledby="contact-paywall-direct-title">
          <p className="contact-paywall__label">Contacto directo</p>
          <p className="contact-paywall__price">RD$89</p>
          <h3 id="contact-paywall-direct-title">¿Solo necesitas hablar con esta persona?</h3>
          <p>Desbloquea su contacto y habla directamente con el trabajador que elegiste.</p>
          <p className="contact-paywall__terms">Un pago. Un contacto.</p>
          <Link className="btn-primary" href={`/empleadores/contacto?worker=${encodeURIComponent(workerId)}`} onClick={() => select("direct")}>Contactar por RD$89</Link>
        </section>
        <section className="contact-paywall__offer" aria-labelledby="contact-paywall-workspace-title">
          <p className="contact-paywall__label">Operación de búsqueda</p>
          <p className="contact-paywall__price">RD$299 / 30 días</p>
          <h3 id="contact-paywall-workspace-title">¿Quieres tener más opciones?</h3>
          <p>Compara candidatos y contacta a los trabajadores que necesites durante 30 días.</p>
          <p className="contact-paywall__terms">Un pago. Más opciones. Más libertad para elegir.</p>
          <Link className="btn-primary" href={`/empleadores/pago?worker=${encodeURIComponent(workerId)}`} onClick={() => select("workspace")}>Desbloquear 30 días — RD$299</Link>
        </section>
      </div>
      <p className="contact-paywall__comparison"><strong>4 contactos individuales = RD$356.</strong><span>30 días de acceso = RD$299.</span></p>
      <p className="contact-paywall__value">Si necesitas contactar a varias personas, el acceso de 30 días puede convenirte más.</p>
    </> : <>
      <p className="contact-paywall__price">RD$299 / 30 días</p>
      <p className="contact-paywall__terms">Un solo pago. Acceso a contactos durante 30 días.</p>
    </>}
    <div className="contact-paywall__actions">{!twoTier && <Link className="btn-primary" href={`/empleadores/pago?worker=${encodeURIComponent(workerId)}`} onClick={() => select("workspace")}>Desbloquear contactos — RD$299</Link>}<button type="button" className="btn-secondary" autoFocus onClick={onClose}>Seguir explorando</button></div>
  </div></div>, document.body);
}
