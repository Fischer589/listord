"use client";
import Link from "next/link";
import { rememberSelectedWorker } from "@/lib/free-contact";

export function ContactPaywall({ workerId, onClose }: { workerId: string; onClose: () => void }) {
  return <div className="contact-paywall-backdrop"><div role="dialog" aria-modal="true" aria-labelledby="contact-paywall-title" aria-describedby="contact-paywall-description" className="contact-paywall" onKeyDown={e => { if (e.key === "Escape") onClose(); }}>
    <h2 id="contact-paywall-title">Desbloquea el contacto con trabajadores</h2>
    <p className="contact-paywall__price">RD$299 / 30 días</p>
    <p id="contact-paywall-description">Explora perfiles gratis. Paga para contactar trabajadores durante 30 días.</p>
    <div className="contact-paywall__actions"><Link className="btn-primary" href={`/empleadores/pago?worker=${encodeURIComponent(workerId)}`} onClick={() => rememberSelectedWorker(workerId)}>Desbloquear contactos — RD$299</Link><button type="button" className="btn-secondary" autoFocus onClick={onClose}>Seguir explorando</button></div>
  </div></div>;
}
