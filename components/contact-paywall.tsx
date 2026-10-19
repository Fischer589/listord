"use client";
import Link from "next/link";
import { createPortal } from "react-dom";
import { rememberSelectedWorker } from "@/lib/free-contact";
import { publicWorkerText } from "@/lib/public-worker";

export function ContactPaywall({ workerId, occupation, city, onClose }: { workerId: string; occupation?: string | null; city?: string | null; onClose: () => void }) {
  const selection = [publicWorkerText(occupation), publicWorkerText(city)].filter(Boolean).join(" · ");
  if (typeof document === "undefined") return null;
  return createPortal(<div className="contact-paywall-backdrop"><div role="dialog" aria-modal="true" aria-labelledby="contact-paywall-title" className="contact-paywall" onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
    {selection && <p className="contact-paywall__selection">Perfil seleccionado: {selection}</p>}
    <h2 id="contact-paywall-title">¿Listo para terminar tu búsqueda? 🎯</h2>
    <p>El talento que necesitas podría estar a un mensaje de distancia.</p>
    <p><strong>Por solo RD$100, conecta directamente por WhatsApp con el profesional que elegiste.</strong></p>
    <p>Sin intermediarios. Sin comisiones sobre salarios. Tú decides a quién contratar.</p>
    <p>Si ya tienes créditos, usarás uno para este contacto. Los contactos desbloqueados siguen disponibles sin otro cargo.</p>
    <div className="contact-paywall__offers">
      <section className="contact-paywall__offer"><h3>1 contacto</h3><p className="contact-paywall__price">RD$100</p><p>RD$100 por trabajador.</p></section>
      <section className="contact-paywall__offer"><h3>5 contactos</h3><p className="contact-paywall__price">RD$445</p><p>RD$89 por trabajador.</p></section>
      <section className="contact-paywall__offer"><h3>10 contactos</h3><p className="contact-paywall__price">RD$890</p><p>RD$89 por trabajador.</p></section>
    </div>
    <div className="contact-paywall__actions"><Link className="btn-primary" href={`/empleadores/contacto?worker=${encodeURIComponent(workerId)}`} onClick={() => rememberSelectedWorker(workerId)}>Ver mis créditos y conectar</Link>
      <button type="button" className="btn-secondary" autoFocus onClick={onClose}>Seguir explorando</button></div>
  </div></div>, document.body);
}
