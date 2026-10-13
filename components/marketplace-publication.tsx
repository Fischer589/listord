"use client";
import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { requestSummary, type RequestDraft } from "@/lib/request-specification";
import { MarketplaceSession, marketplaceRequest } from "./marketplace-session";

export function MarketplacePublication({ draft }: { draft: RequestDraft }) {
  return <section className="publication-panel"><p className="t-eyebrow">Opcional · gratis</p><h2>Publicar oportunidad</h2>
    <p>Tu solicitud sigue privada hasta que elijas publicarla y un administrador la apruebe. Revisa exactamente lo que podrán ver los trabajadores:</p>
    <div className="request-preview" aria-label="Vista previa pública"><p>{requestSummary(draft)}</p></div>
    <p>Solo se publicarán estos términos. Tu nombre y WhatsApp se guardan aparte y no aparecen en la oportunidad pública.</p>
    <MarketplaceSession emailRedirectPath="/solicitar">{token => <PublicationForm token={token} draft={draft} />}</MarketplaceSession></section>;
}
function PublicationForm({ token, draft }: { token: string; draft: RequestDraft }) {
  const key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(""); const [saved, setSaved] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setNotice("");
    key.current ??= crypto.randomUUID();
    try {
      await marketplaceRequest(token, { action: "create", draft, key: key.current, name: form.get("name"), phone: form.get("phone"), consent: form.get("consent") === "on" });
      setSaved(true); setNotice("Solicitud guardada para revisión. Aún no está publicada.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "No se confirmó el guardado."); }
    finally { setBusy(false); }
  }
  return <><form onSubmit={submit} className="request-fields"><label>Nombre de contacto privado<input name="name" minLength={2} maxLength={100} required disabled={saved} /></label><label>WhatsApp de contacto privado<input name="phone" type="tel" maxLength={40} required disabled={saved} /></label>
    <label><input name="consent" type="checkbox" required disabled={saved} /> Autorizo enviar estos términos públicos a revisión. Confirmo que no incluyen datos personales, direcciones exactas ni información sensible.</label>
    <button className="btn-primary" disabled={busy || saved}>Enviar a revisión</button></form><p role="status">{notice}</p>{saved && <Link href="/empleadores/mi-cuenta">Ver mis oportunidades</Link>}</>;
}
