"use client";
import { useState, type FormEvent } from "react";
export function AdminAvailabilityAccess({ workerId, ownerLinked }: { workerId: string; ownerLinked: boolean }) {
  const [linked, setLinked] = useState(ownerLinked);
  const [verified, setVerified] = useState(false);
  const [consented, setConsented] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function linkOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "link_owner", id: workerId, owner: form.get("owner"), evidence: form.get("evidence"),
        operator: form.get("operator"), identityVerified: form.get("verified") === "on"
      }) });
      const body = await response.json();
      if (!response.ok || body.saved !== true) throw new Error(body.error || "No pudimos vincular al titular.");
      setLinked(true);
      setNotice("Titular vinculado. La persona todavía debe solicitar su enlace y confirmar disponibilidad.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos vincular al titular."); }
    finally { setBusy(false); }
  }
  async function issue() {
    setBusy(true); setError(""); setLink("");
    try {
      const response = await fetch("/api/admin/availability-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workerId, ownershipConfirmed: verified, consentConfirmed: consented }) });
      const body = await response.json();
      if (!response.ok || !body.path) throw new Error(body.error || "No pudimos crear el enlace.");
      setLink(new URL(body.path, window.location.origin).toString());
    } catch(error) { setError(error instanceof Error ? error.message : "No pudimos crear el enlace."); }
    finally { setBusy(false); }
  }
  return <details className="mt-4 border-t p-3">
    <summary className="cursor-pointer font-bold">{linked ? "Enlace privado de disponibilidad" : "Vincular titular para activar disponibilidad"}</summary>
    {!linked ? <form className="mt-3 grid gap-3" onSubmit={linkOwner}>
      <p>Vincula solo después de comprobar por un canal independiente que la cuenta pertenece a este perfil y que el trabajador pidió vincularla. Un teléfono, correo o enlace antiguo no bastan.</p>
      <label>ID de cuenta Auth verificada<input className="mt-1 block w-full rounded-md border p-2" name="owner" required /></label>
      <label>Referencia privada de evidencia<input className="mt-1 block w-full rounded-md border p-2" name="evidence" pattern="[A-Za-z0-9:_-]{5,160}" required /></label>
      <label>Responsable de verificación<input className="mt-1 block w-full rounded-md border p-2" name="operator" pattern="[A-Za-z0-9_-]{3,60}" required /></label>
      <label><input type="checkbox" name="verified" required /> Confirmé identidad, titularidad e instrucción de vincular esta cuenta.</label>
      <button className="btn-secondary" disabled={busy} type="submit">{busy ? "Vinculando…" : "Vincular sin activar"}</button>
    </form> : <div className="mt-3">
      <label><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} /> Verifiqué por un canal seguro que esta persona es titular del perfil.</label>
      <label className="mt-2 block"><input type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)} /> El titular solicitó recibir este enlace privado. Esto no confirma su disponibilidad ni autoriza mensajes de Express.</label>
      <p>El enlace anterior de disponibilidad dejará de funcionar. No uses un teléfono escrito o un edit_token público como prueba.</p>
      <button className="btn-secondary" disabled={!verified || !consented || busy} onClick={issue}>{busy ? "Creando…" : "Crear enlace privado de disponibilidad"}</button>
      {link && <label className="block">Enlace privado (entregar solo al titular verificado)<textarea className="w-full" readOnly value={link} onFocus={e => e.target.select()} /></label>}
    </div>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
