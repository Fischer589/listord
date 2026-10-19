"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceSession } from "./marketplace-session";
import { isValidWhatsAppUrl } from "@/lib/whatsapp";
import { rememberSelectedWorker } from "@/lib/free-contact";

const packs = [
  { pack: 1, amount: "RD$100", unit: "RD$100 por contacto" },
  { pack: 5, amount: "RD$445", unit: "RD$89 por contacto" },
  { pack: 10, amount: "RD$890", unit: "RD$89 por contacto" },
] as const;

export function ContactCreditsSession({ workerId, returned }: { workerId: string | null; returned: boolean }) {
  return <MarketplaceSession emailRedirectPath="/empleadores/contacto" beforeSendEmail={() => { if (workerId) rememberSelectedWorker(workerId); }}
    description="Verifica tu correo para ver tus créditos y conectar con el talento que elijas. Explorar perfiles sigue siendo gratis.">
    {token => <ContactCreditsCheckout token={token} workerId={workerId} returned={returned} />}
  </MarketplaceSession>;
}

function ContactCreditsCheckout({ token, workerId, returned }: { token: string; workerId: string | null; returned: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [alreadyUnlocked, setAlreadyUnlocked] = useState(false);
  const [contactActive, setContactActive] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [unlocked, setUnlocked] = useState<Array<{ workerId: string; name: string }>>([]);
  const [legacyActive, setLegacyActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const [response, selected] = await Promise.all([
      fetch("/api/contact-credits", { cache: "no-store", headers, signal: AbortSignal.timeout(15000) }),
      workerId ? fetch(`/api/contact-access?worker=${encodeURIComponent(workerId)}`,
        { cache: "no-store", headers, signal: AbortSignal.timeout(15000) }) : Promise.resolve(null),
    ]);
    const result = await response.json() as { remaining?: number; unlocked?: Array<{ workerId: string; name: string }>; legacyActive?: boolean; error?: string };
    if (!response.ok) throw new Error(result.error || "No pudimos consultar tu saldo.");
    setRemaining(result.remaining ?? 0);
    setUnlocked(result.unlocked ?? []);
    setLegacyActive(result.legacyActive === true);
    if (selected) {
      const detail = await selected.json() as { active?: boolean; alreadyUnlocked?: boolean; unavailable?: boolean; error?: string };
      if (!selected.ok) throw new Error(detail.error || "No pudimos verificar el contacto.");
      setContactActive(detail.active === true);
      setAlreadyUnlocked(detail.alreadyUnlocked ?? false);
      setUnavailable(detail.unavailable ?? false);
    }
  }, [token, workerId]);
  useEffect(() => { void refresh().catch(cause => setError(cause instanceof Error ? cause.message : "Saldo no disponible.")); }, [refresh]);
  useEffect(() => {
    if (!returned) return;
    const poll = window.setInterval(() => { void refresh().catch(() => {}); }, 4000);
    const stop = window.setTimeout(() => window.clearInterval(poll), 60_000);
    return () => { window.clearInterval(poll); window.clearTimeout(stop); };
  }, [returned, refresh]);
  async function buy(pack: 1 | 5 | 10) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/stripe/contact-credits-checkout", { method: "POST", cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ pack, ...(workerId ? { workerId } : {}) }), signal: AbortSignal.timeout(20000) });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url?.startsWith("https://checkout.stripe.com/")) throw new Error(result.error || "No pudimos preparar el pago.");
      window.location.assign(result.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos preparar el pago."); setBusy(false); }
  }
  async function contact() {
    if (!workerId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/workers/contact", { method: "POST", cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ workerId }), signal: AbortSignal.timeout(20000) });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url || !isValidWhatsAppUrl(result.url)) throw new Error(result.error || "No pudimos abrir el contacto.");
      window.location.assign(result.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos abrir el contacto."); setBusy(false); }
  }
  const canContact = workerId && !unavailable && (contactActive || (remaining ?? 0) > 0);
  const needsPurchase = workerId && remaining === 0 && !unavailable && !contactActive;
  return <section className="payment-flow" aria-label="Créditos de contacto">
    <p role="status">{remaining === null ? "Consultando saldo..." : `Créditos disponibles: ${remaining}`}</p>
    {legacyActive && <p role="status">Tu pase anterior sigue activo. Puedes contactar trabajadores durante su vigencia sin gastar créditos.</p>}
    {workerId && <><h2>¿Listo para terminar tu búsqueda? 🎯</h2><p>El talento que necesitas podría estar a un mensaje de distancia.</p>
      <p>{unavailable ? "Este trabajador no tiene un contacto válido disponible. No se usará ningún crédito." : alreadyUnlocked ? "Este contacto ya está desbloqueado. Puedes abrir WhatsApp sin pagar ni gastar otro crédito." : remaining === null ? "Verificando si ya tienes acceso o créditos para este contacto." : contactActive ? "Tu acceso anterior permite abrir WhatsApp sin gastar créditos." : remaining > 0 ? "Conecta por WhatsApp con el profesional que elegiste. Usarás 1 crédito de tu saldo; no habrá otro pago." : "Por solo RD$100, conecta directamente por WhatsApp con el profesional que elegiste. Elige un paquete para continuar."}</p>
      {!unavailable && <p>Sin intermediarios. Sin comisiones sobre salarios. Tú decides a quién contratar.</p>}</>}
    {canContact && <button type="button" className="btn-primary" disabled={busy} onClick={() => void contact()}>{contactActive ? "Abrir WhatsApp" : "Usar 1 crédito y abrir WhatsApp"}</button>}
    <section aria-label="Contactos ya desbloqueados"><h2>Contactos ya desbloqueados</h2>
      {unlocked.length ? <ul>{unlocked.map(item => <li key={item.workerId}>
        <Link href={`/empleadores/contacto?worker=${encodeURIComponent(item.workerId)}`}>{item.name}</Link>
      </li>)}</ul> : <p>Aún no has desbloqueado contactos.</p>}
    </section>
    <div className="contact-paywall__offers">{packs.map(item => <section className="contact-paywall__offer" key={item.pack}>
      <h2>{item.pack} {item.pack === 1 ? "contacto" : "contactos"}</h2><p className="contact-paywall__price">{item.amount}</p><p>{item.unit} · Un solo pago</p>
      <button type="button" className="btn-primary" disabled={busy || remaining === null || unavailable} onClick={() => void buy(item.pack)}>{needsPurchase && item.pack === 1 ? "Conectar por WhatsApp — RD$100" : `Comprar ${item.pack}`}</button>
    </section>)}</div>
    {needsPurchase && <p>Al elegir un paquete, irás a Stripe Checkout. Podrás abrir WhatsApp cuando se confirme el pago y el crédito aparezca en tu saldo.</p>}
    {returned && <p role="status">Esperando la confirmación firmada de Stripe. El regreso del pago no agrega créditos por sí solo.</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => void refresh().catch(() => {})}>Actualizar saldo</button></p>}
    <Link href="/">Seguir explorando perfiles</Link>
  </section>;
}
