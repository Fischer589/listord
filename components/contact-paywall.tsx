"use client";
import Link from "next/link";
import { rememberSelectedWorker } from "@/lib/free-contact";
import { publicWorkerText } from "@/lib/public-worker";

export function ContactPaywall({ workerId, occupation, city, onClose }: { workerId: string; occupation?: string | null; city?: string | null; onClose: () => void }) {
  const safeOccupation = publicWorkerText(occupation);
  const safeCity = publicWorkerText(city);
  return <div className="contact-paywall-backdrop"><div role="dialog" aria-modal="true" aria-labelledby="contact-paywall-title" aria-describedby="contact-paywall-description" className="contact-paywall" onKeyDown={e => { if (e.key === "Escape") onClose(); }}>
    {(safeOccupation || safeCity) && <p className="contact-paywall__selection">Perfil seleccionado: {[safeOccupation, safeCity].filter(Boolean).join(" · ")}</p>}
    <h2 id="contact-paywall-title">¿Encontraste a la persona indicada?</h2>
    <p id="contact-paywall-description">Desbloquea el contacto directo con los trabajadores que te interesan y encuentra a quien necesitas.</p>
    <p className="contact-paywall__price">RD$299 / 30 días</p>
    <p className="contact-paywall__terms">Un solo pago. Acceso a contactos durante 30 días.</p>
    <div className="contact-paywall__actions"><Link className="btn-primary" href={`/empleadores/pago?worker=${encodeURIComponent(workerId)}`} onClick={() => rememberSelectedWorker(workerId)}>Desbloquear contactos — RD$299</Link><button type="button" className="btn-secondary" autoFocus onClick={onClose}>Seguir explorando</button></div>
  </div></div>;
}
