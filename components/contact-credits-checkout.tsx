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
    description="Verifica tu correo para comprar créditos de contacto. Explorar perfiles sigue siendo gratis.">
    {token => <ContactCreditsCheckout token={token} workerId={workerId} returned={returned} />}
  </MarketplaceSession>;
}

function ContactCreditsCheckout({ token, workerId, returned }: { token: string; workerId: string | null; returned: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [alreadyUnlocked, setAlreadyUnlocked] = useState(false);
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
      const detail = await selected.json() as { alreadyUnlocked?: boolean; unavailable?: boolean; error?: string };
      if (!selected.ok) throw new Error(detail.error || "No pudimos verificar el contacto.");
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
  return <section className="payment-flow" aria-label="Créditos de contacto">
    <p role="status">{remaining === null ? "Consultando saldo..." : `Créditos disponibles: ${remaining}`}</p>
    {legacyActive && <p role="status">Tu pase anterior sigue activo. Puedes contactar trabajadores durante su vigencia sin gastar créditos.</p>}
    {workerId && <p>{unavailable ? "Este trabajador no tiene un contacto válido disponible. No se usará ningún crédito." : alreadyUnlocked ? "Este trabajador ya está desbloqueado. No se cobrará otro crédito." : remaining ? "Puedes usar un crédito para desbloquear este trabajador." : "Necesitas un crédito para desbloquear este trabajador."}</p>}
    {workerId && !unavailable && (alreadyUnlocked || (remaining ?? 0) > 0) && <button type="button" className="btn-primary" disabled={busy} onClick={() => void contact()}>{alreadyUnlocked ? "Contactar otra vez" : "Usar 1 crédito y contactar"}</button>}
    <section aria-label="Contactos ya desbloqueados"><h2>Contactos ya desbloqueados</h2>
      {unlocked.length ? <ul>{unlocked.map(item => <li key={item.workerId}>
        <Link href={`/empleadores/contacto?worker=${encodeURIComponent(item.workerId)}`}>{item.name}</Link>
      </li>)}</ul> : <p>Aún no has desbloqueado contactos.</p>}
    </section>
    <div className="contact-paywall__offers">{packs.map(item => <section className="contact-paywall__offer" key={item.pack}>
      <h2>{item.pack} {item.pack === 1 ? "contacto" : "contactos"}</h2><p className="contact-paywall__price">{item.amount}</p><p>{item.unit} · Un solo pago</p>
      <button type="button" className="btn-primary" disabled={busy} onClick={() => void buy(item.pack)}>Comprar {item.pack}</button>
    </section>)}</div>
    {returned && <p role="status">Esperando la confirmación firmada de Stripe. El regreso del pago no agrega créditos por sí solo.</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => void refresh().catch(() => {})}>Actualizar saldo</button></p>}
    <Link href="/">Seguir explorando perfiles</Link>
  </section>;
}
