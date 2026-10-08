"use client";
import { useState } from "react";
export function AdminAvailabilityAccess({ workerId }: { workerId: string }) {
  const [verified, setVerified] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function issue() {
    setBusy(true); setError(""); setLink("");
    try {
      const response = await fetch("/api/admin/availability-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workerId, ownershipConfirmed: verified }) });
      const body = await response.json();
      if (!response.ok || !body.path) throw new Error(body.error || "No pudimos crear el enlace.");
      setLink(new URL(body.path, window.location.origin).toString());
    } catch(error) { setError(error instanceof Error ? error.message : "No pudimos crear el enlace."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 border-t p-3">
    <label><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} /> Verifiqué por un canal seguro que esta persona es titular del perfil.</label>
    <p>El enlace anterior de disponibilidad dejará de funcionar. No uses un teléfono escrito o un edit_token público como prueba.</p>
    <button className="btn-secondary" disabled={!verified || busy} onClick={issue}>{busy ? "Creando…" : "Crear enlace privado de disponibilidad"}</button>
    {link && <label className="block">Enlace privado (entregar solo al titular verificado)<textarea className="w-full" readOnly value={link} onFocus={e => e.target.select()} /></label>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
