"use client";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { clearPersistedMarketplaceSession, clearWorkspaceCheckoutReturn, getMarketplaceBrowserClient, persistMarketplaceSession, restoreMarketplaceSession } from "@/lib/marketplace-browser";
import { marketplaceAuthCallbackUrl, type MarketplaceAuthIntent } from "@/lib/marketplace-auth-redirect";

/** Restore a verified session before offering another email code. */
export function MarketplaceSession({ children, description = "Puedes explorar sin cuenta. Verifica tu correo una vez para publicar o responder. Si ya tienes un perfil, solicita su vinculación tras verificar que te pertenece.", emailRedirectPath, beforeSendEmail }: { children: (token: string) => ReactNode; description?: string; emailRedirectPath: "/empleadores/mi-cuenta" | "/empleadores/contacto" | "/solicitar" | "/oportunidades" | "/trabajadores/activar"; beforeSendEmail?: () => void }) {
  const [client, setClient] = useState<ReturnType<typeof getMarketplaceBrowserClient>>(null);
  const [account, setAccount] = useState("");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [notice, setNotice] = useState("");
  const logoutVersion = useRef(0);
  useEffect(() => {
    const browserClient = getMarketplaceBrowserClient();
    if (!browserClient) { clearAuthFragment(); clearCheckoutReturnBridge(); setRestoring(false); }
    setClient(browserClient);
  }, []);
  useEffect(() => {
    if (!client) return;
    let mounted = true;
    const subscription = client.auth.onAuthStateChange((event, session) => {
      setToken(session?.access_token ?? ""); setAccount(session?.user.id ?? "");
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        const version = logoutVersion.current;
        setTimeout(() => { if (mounted && version === logoutVersion.current) void persistMarketplaceSession(session); }, 0);
      }
    });
    const linkError = hasAuthError();
    void client.auth.initialize().then(async ({ error }) => {
      if (!error && !linkError) {
        const session = await restoreMarketplaceSession(client);
        if (mounted && session) { setToken(session.access_token); setAccount(session.user.id); }
      }
      clearAuthFragment();
      clearCheckoutReturnBridge();
      if (mounted && (error || linkError)) setNotice("El enlace de verificación venció o no es válido. Solicita un nuevo código.");
    }).catch(() => { if (mounted) setNotice("No se pudo restaurar la sesión. Intenta de nuevo."); })
      .finally(() => { if (mounted) setRestoring(false); });
    return () => { mounted = false; subscription.data.subscription.unsubscribe(); };
  }, [client]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      if (!client) throw new Error();
      if (!sent) {
        beforeSendEmail?.();
        const intent: MarketplaceAuthIntent = emailRedirectPath === "/solicitar" ? "publish" : emailRedirectPath === "/oportunidades" ? "apply" : emailRedirectPath === "/empleadores/contacto" ? "direct" : emailRedirectPath === "/trabajadores/activar" ? "worker" : "account";
        const { error } = await client.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: marketplaceAuthCallbackUrl(intent, window.location.origin,
            intent === "direct" ? new URLSearchParams(window.location.search).get("worker") : null) },
        });
        if (error) throw error;
        setSent(true); setNotice("Revisa tu correo para obtener el código. No lo compartas.");
      } else {
        const { data, error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
        if (error || !data.session) throw new Error();
        await persistMarketplaceSession(data.session);
        setAccount(data.session.user.id); setToken(data.session.access_token); setCode(""); setNotice("");
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      setNotice(!client ? "El acceso por correo no está disponible. Intenta más tarde." : sent
        ? "No se pudo verificar el código. Comprueba que sea correcto e intenta de nuevo."
        : code === "email_address_not_authorized" ? "Este correo no está autorizado para recibir códigos. Contacta al administrador."
        : code === "email_address_invalid" ? "Este correo no es válido para el servicio de verificación. Usa otra dirección."
        : code === "over_email_send_rate_limit" || code === "over_request_rate_limit" ? "Se alcanzó el límite de solicitudes de código. Espera antes de intentar de nuevo."
        : "No se pudo enviar el código. Comprueba el correo e intenta más tarde.");
    }
    finally { setBusy(false); }
  }
  async function signOut() {
    if (!client) return;
    logoutVersion.current++;
    setBusy(true);
    const cleared = await clearPersistedMarketplaceSession();
    if (!cleared) { setNotice("No se pudo cerrar la sesión. Intenta de nuevo."); setBusy(false); return; }
    const result = await client.auth.signOut({ scope: "local" });
    if (result.error) { setNotice("No se pudo cerrar la sesión. Intenta de nuevo."); setBusy(false); return; }
    clearWorkspaceCheckoutReturn(); setToken(""); setAccount(""); setSent(false); setCode(""); setBusy(false);
  }
  if (restoring) return <p role="status">Restaurando sesión…</p>;
  if (token) return <><button className="btn-secondary" disabled={busy} onClick={() => void signOut()}>Cerrar sesión</button><p className="text-sm">Sesión verificada.</p>{notice && <p role="status">{notice}</p>}<div key={account}>{children(token)}</div></>;
  return <section aria-label="Acceso verificado"><h2>Verifica tu correo</h2><p>{description}</p>
    <form onSubmit={submit} className="request-fields"><label>Correo electrónico<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={sent || busy} onChange={e => { setEmail(e.target.value); setNotice(""); }} onInvalid={e => setNotice(e.currentTarget.validity.valueMissing ? "Escribe tu correo electrónico para recibir el código." : "Escribe un correo electrónico válido.")} /></label>
      {sent && <label>Código de verificación<input autoComplete="one-time-code" inputMode="numeric" required minLength={6} maxLength={10} value={code} onChange={e => setCode(e.target.value)} /></label>}
      <button className="btn-primary" disabled={busy}>{sent ? "Verificar código" : "Enviar código"}</button>
      {sent && <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setSent(false); setCode(""); }}>Usar otro correo</button>}
    </form>{notice && <p role="status">{notice}</p>}</section>;
}

function clearAuthFragment() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const authQuery = ["error", "error_code", "error_description"].some(key => query.has(key));
  if (authQuery) for (const key of ["error", "error_code", "error_description"]) query.delete(key);
  if (fragment.has("access_token") || fragment.has("refresh_token") || fragment.has("error") || fragment.has("error_code") || window.location.href.endsWith("#") || authQuery) {
    window.history.replaceState(window.history.state, "", window.location.pathname + (query.size ? `?${query}` : ""));
  }
}

function hasAuthError() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  return fragment.has("error") || fragment.has("error_code") || query.has("error") || query.has("error_code");
}

function clearCheckoutReturnBridge() {
  const query = new URLSearchParams(window.location.search);
  if (query.get("checkout") === "cancel") clearWorkspaceCheckoutReturn();
  else if (query.get("checkout") === "return" && query.get("session_id")) {
    clearWorkspaceCheckoutReturn(query.get("session_id")!);
  }
}

export async function marketplaceRequest(token: string, body?: unknown, path = "/api/marketplace?mine=true") {
  const response = await fetch(body ? path.split("?")[0] : path, {
    method: body ? "POST" : "GET", cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "No se confirmó la operación.");
  return data;
}
