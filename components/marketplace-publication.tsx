"use client";
import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import type { RequestDraft } from "@/lib/request-specification";
import { MarketplaceSession, marketplaceRequest } from "./marketplace-session";

export function MarketplacePublication({ draft }: { draft: RequestDraft }) {
  return <section><h2>Publicar una oportunidad gratis</h2><p>Tu solicitud pasará por revisión antes de hacerse pública. No incluyas datos privados en las tareas ni en la ciudad. El contacto se comparte solo con participantes autorizados.</p>
    <MarketplaceSession>{token => <PublicationForm token={token} draft={draft} />}</MarketplaceSession></section>;
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
    <label><input name="consent" type="checkbox" required disabled={saved} /> Autorizo publicar los términos de esta solicitud y compartir mi WhatsApp con trabajadores que respondan SÍ. No he incluido datos privados en el contenido público.</label>
    <button className="btn-primary" disabled={busy || saved}>Enviar a revisión</button></form><p role="status">{notice}</p>{saved && <Link href="/oportunidades">Ver mis oportunidades</Link>}</>;
}
