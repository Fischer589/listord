"use client";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { getMarketplaceBrowserClient } from "@/lib/marketplace-browser";

/** Tab-scoped session; tokens never enter URLs, analytics or rendered markup. */
export function MarketplaceSession({ children, description = "Puedes explorar sin cuenta. Verifica tu correo una vez para publicar o responder. Si ya tienes un perfil, solicita su vinculación tras verificar que te pertenece.", emailRedirectPath }: { children: (token: string) => ReactNode; description?: string; emailRedirectPath?: "/empleadores/mi-cuenta" }) {
  const [client, setClient] = useState<ReturnType<typeof getMarketplaceBrowserClient>>(null);
  const [account, setAccount] = useState("");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setClient(getMarketplaceBrowserClient());
  }, []);
  useEffect(() => {
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? ""); setAccount(session?.user.id ?? "");
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [client]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      if (!client) throw new Error();
      if (!sent) {
        const { error } = await client.auth.signInWithOtp({
          email: email.trim(),
          ...(emailRedirectPath ? { options: { emailRedirectTo: new URL(emailRedirectPath, window.location.origin).href } } : {}),
        });
        if (error) throw error;
        setSent(true); setNotice("Revisa tu correo para obtener el código. No lo compartas.");
      } else {
        const { data, error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
        if (error || !data.session) throw new Error();
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
  if (token) return <><button className="btn-secondary" onClick={() => { setToken(""); setSent(false); setCode(""); void client?.auth.signOut({ scope: "local" }); }}>Cerrar sesión</button><p className="text-sm">Sesión verificada en esta pestaña.</p><div key={account}>{children(token)}</div></>;
  return <section aria-label="Acceso verificado"><h2>Verifica tu correo</h2><p>{description}</p>
    <form onSubmit={submit} className="request-fields"><label>Correo electrónico<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={sent || busy} onChange={e => { setEmail(e.target.value); setNotice(""); }} onInvalid={e => setNotice(e.currentTarget.validity.valueMissing ? "Escribe tu correo electrónico para recibir el código." : "Escribe un correo electrónico válido.")} /></label>
      {sent && <label>Código de verificación<input autoComplete="one-time-code" inputMode="numeric" required minLength={6} maxLength={10} value={code} onChange={e => setCode(e.target.value)} /></label>}
      <button className="btn-primary" disabled={busy}>{sent ? "Verificar código" : "Enviar código"}</button>
      {sent && <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setSent(false); setCode(""); }}>Usar otro correo</button>}
    </form>{notice && <p role="status">{notice}</p>}</section>;
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
