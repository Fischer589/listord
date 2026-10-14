"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceSession } from "./marketplace-session";
import { bindWorkspaceCheckoutReturn, prepareWorkspaceCheckoutReturn } from "@/lib/marketplace-browser";
import { rememberSelectedWorker, selectedWorker } from "@/lib/free-contact";
import { trackEvent } from "@/lib/analytics";

export function DirectContactSession({ workerId }: { workerId: string | null }) {
  return <MarketplaceSession emailRedirectPath="/empleadores/contacto" beforeSendEmail={() => { if (workerId) rememberSelectedWorker(workerId); }}
    description="Verifica tu correo para comprar el contacto del trabajador elegido. Explorar perfiles sigue siendo gratis.">
    {token => <DirectContactCheckout token={token} workerId={workerId} />}
  </MarketplaceSession>;
}

function DirectContactCheckout({ token, workerId }: { token: string; workerId: string | null }) {
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  const selectedId = workerId || selectedWorker();
  useEffect(() => {
    let disposed = false;
    async function start() {
      if (!selectedId) { setError("Vuelve a elegir el trabajador que quieres contactar."); return; }
      try {
        rememberSelectedWorker(selectedId);
        const status = await fetch(`/api/contact-access?worker=${encodeURIComponent(selectedId)}`, { cache: "no-store",
          headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
        if (!status.ok) throw new Error("No pudimos verificar tu acceso. Intenta más tarde.");
        const access = await status.json() as { active?: boolean };
        if (disposed) return;
        if (access.active) { setActive(true); return; }
        if (!await prepareWorkspaceCheckoutReturn()) throw new Error("Tu navegador no pudo conservar la sesión para volver del pago.");
        const response = await fetch("/api/stripe/direct-contact-checkout", { method: "POST", cache: "no-store",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ workerId: selectedId }), signal: AbortSignal.timeout(20000) });
        const result = await response.json() as { url?: string; sessionId?: string; alreadyActive?: boolean; error?: string };
        if (!response.ok) throw new Error(result.error || "No pudimos preparar el pago.");
        if (disposed) return;
        if (result.alreadyActive) { setActive(true); return; }
        if (!/^cs_(?:test|live)_[A-Za-z0-9_]+$/.test(result.sessionId ?? "") ||
            !result.url?.startsWith("https://checkout.stripe.com/") || !bindWorkspaceCheckoutReturn(result.sessionId!)) {
          throw new Error("No se confirmó la página de pago.");
        }
        trackEvent("checkout_start", { plan: "direct", stage: "initiated" });
        window.location.assign(result.url);
      } catch (cause) { if (!disposed) setError(cause instanceof Error ? cause.message : "No pudimos preparar el pago."); }
    }
    void start();
    return () => { disposed = true; };
  }, [token, selectedId]);
  return <div className="payment-flow">
    <p className="workspace-eyebrow">Pago seguro · Stripe</p>
    <h2>Contacto directo · RD$89</h2>
    <p className="payment-flow__line">Un pago · Un trabajador · Sin renovación automática</p>
    {active ? <p role="status" className="payment-flow__success">Ya puedes contactar a esta persona. <Link href={`/trabajador/${encodeURIComponent(selectedId!)}`}>Volver al perfil</Link></p> :
      <p role="status" className="payment-flow__status">{error || "Verificando acceso y preparando el pago seguro..."}</p>}
    {error && <Link className="btn-secondary" href={selectedId ? `/trabajador/${encodeURIComponent(selectedId)}` : "/"}>Seguir explorando</Link>}
  </div>;
}
