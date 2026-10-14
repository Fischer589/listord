"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getMarketplaceBrowserClient, persistMarketplaceSession } from "@/lib/marketplace-browser";

const failure = "El enlace de verificación venció o no es válido. Solicita un nuevo código desde ListoRD.";

export function MarketplaceAuthCallback({ destination }: { destination: string }) {
  const [message, setMessage] = useState("Verificando tu correo…");
  const [failed, setFailed] = useState(false);
  const confirmation = useRef<Promise<void> | null>(null);
  useEffect(() => {
    let active = true;
    const search = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const tokenHash = search.get("token_hash");
    const type = search.get("type");
    const hasImplicitSession = fragment.has("access_token") && fragment.has("refresh_token");
    const hasCode = search.has("code");
    const hasError = search.has("error") || search.has("error_code") || fragment.has("error") || fragment.has("error_code");
    const clearUrl = () => window.history.replaceState(window.history.state, "", window.location.pathname);
    async function confirm() {
      if (hasError || (!tokenHash && !hasImplicitSession && !hasCode) ||
          (tokenHash && type !== "email" && type !== "magiclink")) throw new Error("INVALID_LINK");
      const client = getMarketplaceBrowserClient();
      if (!client) throw new Error("AUTH_UNAVAILABLE");
      if (tokenHash) {
        clearUrl();
        const initialized = await client.auth.initialize();
        if (initialized.error) throw initialized.error;
        const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
        if (verified.error || !verified.data.session) throw new Error("INVALID_LINK");
      } else {
        const initialized = await client.auth.initialize();
        clearUrl();
        if (initialized.error) throw initialized.error;
      }
      const { data, error } = await client.auth.getUser();
      if (error || !data.user || data.user.is_anonymous || !(data.user.email_confirmed_at || data.user.phone_confirmed_at)) throw new Error("UNVERIFIED");
      const session = await client.auth.getSession();
      if (!session.data.session || !await persistMarketplaceSession(session.data.session)) throw new Error("SESSION_UNAVAILABLE");
    }
    confirmation.current ??= confirm();
    void confirmation.current.then(() => {
      if (active) window.location.replace(destination);
    }).catch(() => {
      clearUrl();
      if (active) { setFailed(true); setMessage(failure); }
    });
    return () => { active = false; };
  }, [destination]);
  return <section aria-labelledby="auth-callback-title">
    <h1 id="auth-callback-title">Verificación de correo</h1>
    <p role={failed ? "alert" : "status"}>{message}</p>
    {failed && <Link className="btn-primary" href={destination}>Volver a ListoRD</Link>}
  </section>;
}
