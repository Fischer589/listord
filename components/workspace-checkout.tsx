"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js/pure";
import type { StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { bindWorkspaceCheckoutReturn, clearWorkspaceCheckoutReturn, prepareWorkspaceCheckoutReturn } from "@/lib/marketplace-browser";
import { MarketplaceSession } from "./marketplace-session";
import { rememberSelectedWorker, selectedWorker } from "@/lib/free-contact";
import { getBrowserSessionId, trackEvent } from "@/lib/analytics";

type Phase = "loading" | "active" | "unavailable" | "embedded" | "fallback" | "verifying" | "confirmed";
type CheckoutResult = { mode?: string; sessionId?: string; clientSecret?: string; url?: string; error?: string };

async function createCheckout(token: string, mode: "embedded" | "hosted", replaceEmbedded = false, workerId: string | null = null): Promise<CheckoutResult> {
  const response = await fetch("/api/stripe/workspace-checkout", { method: "POST", cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mode, replaceEmbedded, browserSessionId: getBrowserSessionId(), ...(workerId ? { workerId } : {}) }), signal: AbortSignal.timeout(20000) });
  const result = await response.json() as CheckoutResult;
  if (!response.ok) throw new Error(result.error || "No pudimos preparar el pago. Intenta más tarde.");
  return result;
}

function checkoutSessionId(result: CheckoutResult) {
  if (typeof result.sessionId !== "string" || !/^cs_(?:test|live)_[A-Za-z0-9_]+$/.test(result.sessionId)) throw new Error("No se confirmó la sesión de pago.");
  return result.sessionId;
}

export function EmployerPaymentSession({ publishableKey, workerId }: { publishableKey: string; workerId: string | null }) {
  return <MarketplaceSession emailRedirectPath="/empleadores/mi-cuenta" description="Verifica tu correo para comprar el pase de contacto. La exploración sigue siendo gratis." beforeSendEmail={() => { if (workerId) rememberSelectedWorker(workerId); }}>
    {token => <WorkspaceCheckout token={token} publishableKey={publishableKey} workerId={workerId} />}
  </MarketplaceSession>;
}

function WorkspaceCheckout({ token, publishableKey, workerId }: { token: string; publishableKey: string; workerId: string | null }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const mount = useRef<HTMLDivElement>(null);
  const returnWorkerId = workerId || selectedWorker();

  useEffect(() => {
    let disposed = false;
    let checkout: StripeEmbeddedCheckout | null = null;
    async function start() {
      let access: { active?: boolean };
      try {
        const accessResponse = await fetch("/api/employer-workspace", { cache: "no-store",
          headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
        if (!accessResponse.ok) throw new Error();
        access = await accessResponse.json() as { active?: boolean };
      } catch {
        if (!disposed) { setError("No pudimos verificar tu pase. Intenta de nuevo desde tu cuenta."); setPhase("unavailable"); }
        return;
      }
      if (disposed) return;
      if (access.active) { setPhase("active"); return; }
      try {
        if (!/^pk_(?:test|live)_[A-Za-z0-9]+$/.test(publishableKey)) {
          setPhase("fallback");
          return;
        }
        const stripe = await loadStripe(publishableKey);
        if (!stripe || disposed) throw new Error("No se pudo cargar el formulario seguro.");
        if (!await prepareWorkspaceCheckoutReturn()) throw new Error("Tu navegador no pudo conservar la sesión para volver del pago.");
        const result = await createCheckout(token, "embedded", false, returnWorkerId);
        if (disposed) return;
        const id = checkoutSessionId(result);
        if (!bindWorkspaceCheckoutReturn(id)) throw new Error("No pudimos conservar tu sesión para volver del pago.");
        trackEvent("checkout_start", { plan: "workspace", stage: "initiated" });
        if (result.mode === "hosted" && result.url?.startsWith("https://checkout.stripe.com/")) {
          window.location.assign(result.url);
          return;
        }
        if (result.mode !== "embedded" || typeof result.clientSecret !== "string" ||
            !result.clientSecret.startsWith(`${id}_secret_`)) throw new Error("No se confirmó el formulario seguro.");
        setSessionId(id);
        const embedded = await stripe.createEmbeddedCheckoutPage({ clientSecret: result.clientSecret, onComplete: () => {
          if (!disposed) setPhase("verifying");
        } });
        checkout = embedded;
        if (disposed) { embedded.destroy(); return; }
        if (!mount.current) throw new Error("No se pudo mostrar el formulario seguro.");
        embedded.mount(mount.current);
        setPhase("embedded");
      } catch (cause) {
        if (!disposed) {
          setError(cause instanceof Error ? cause.message : "No se pudo mostrar el formulario seguro.");
          setPhase("fallback");
        }
      }
    }
    void start();
    return () => { disposed = true; checkout?.destroy(); };
  }, [token, publishableKey, returnWorkerId]);

  useEffect(() => {
    if (phase !== "verifying") return;
    let stopped = false;
    const check = async () => {
      try {
        const response = await fetch("/api/employer-workspace", { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
        if (!response.ok) return;
        const state = await response.json() as { active?: boolean };
        if (!stopped && state.active) {
          clearWorkspaceCheckoutReturn(sessionId);
          setPhase("confirmed");
        }
      } catch { /* Webhook confirmation can arrive after this request. */ }
    };
    void check();
    const poll = window.setInterval(() => { void check(); }, 4000);
    const timeout = window.setTimeout(() => { window.clearInterval(poll); setError("La confirmación sigue pendiente. Revisa el estado en tu cuenta; no vuelvas a pagar."); }, 60000);
    return () => { stopped = true; window.clearInterval(poll); window.clearTimeout(timeout); };
  }, [phase, token, sessionId]);

  useEffect(() => {
    if (phase !== "confirmed") return;
    const timeout = window.setTimeout(() => window.location.assign(returnWorkerId ? `/trabajador/${encodeURIComponent(returnWorkerId)}` : "/empleadores/mi-cuenta"), 1800);
    return () => window.clearTimeout(timeout);
  }, [phase, returnWorkerId]);

  async function hostedFallback() {
    setBusy(true); setError("");
    try {
      if (!await prepareWorkspaceCheckoutReturn()) throw new Error("Tu navegador no pudo conservar la sesión para volver del pago.");
      const result = await createCheckout(token, "hosted", true, returnWorkerId);
      const id = checkoutSessionId(result);
      if (result.mode !== "hosted" || !result.url?.startsWith("https://checkout.stripe.com/") ||
          !bindWorkspaceCheckoutReturn(id)) throw new Error("No se confirmó la página de pago.");
      trackEvent("checkout_start", { plan: "workspace", stage: "initiated" });
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos abrir el pago seguro.");
      setBusy(false);
    }
  }

  return <div className="payment-flow">
    <p className="workspace-eyebrow">Pago seguro · Stripe</p>
    <h2>Confirma tu pase</h2>
    <p className="payment-flow__line">RD$299 · 30 días · Pago único · Sin renovación automática</p>
    {phase === "loading" && <p role="status" className="payment-flow__status">Preparando tu formulario de pago seguro...</p>}
    {phase === "active" && <p role="status" className="payment-flow__success">Tu Pase de Empleador ya está activo. <a href="/empleadores/mi-cuenta">Abrir mi espacio</a></p>}
    {phase === "unavailable" && <a className="btn-secondary" href="/empleadores/mi-cuenta">Volver a mi cuenta</a>}
    <div ref={mount} className="payment-flow__stripe" hidden={phase !== "loading" && phase !== "embedded"} />
    {phase === "embedded" && <button type="button" className="btn-secondary" onClick={() => { clearWorkspaceCheckoutReturn(); window.location.assign("/empleadores/mi-cuenta?checkout=cancel"); }}>Cancelar y volver a mi cuenta</button>}
    {phase === "fallback" && <div className="payment-flow__fallback"><p role="status">Puedes completar el pago en la página segura de Stripe.</p>
      <button type="button" className="btn-primary" disabled={busy} onClick={() => void hostedFallback()}>{busy ? "Abriendo Stripe..." : "Continuar en Stripe"}</button>
      <a href="/empleadores/mi-cuenta">Cancelar y volver a mi cuenta</a>
    </div>}
    {phase === "verifying" && <p role="status" className="payment-flow__status">Stripe completó el formulario. Esperando la confirmación firmada del pago; todavía no se ha activado el pase.</p>}
    {phase === "confirmed" && <p role="status" className="payment-flow__success">Pago confirmado. Tu Pase de Empleador está activo. Abriendo tu espacio...</p>}
    {error && <p role="alert" className="workspace-feedback workspace-feedback--error">{error}</p>}
    {phase === "verifying" && error && <a className="btn-secondary" href="/empleadores/mi-cuenta?checkout=return">Revisar estado en mi cuenta</a>}
  </div>;
}
