"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { validAvailabilityKey } from "@/lib/availability";

type Availability = { available: boolean; confirmedAt: string | null; fresh: boolean };
export function WorkerAvailability({ enabled }: { enabled: boolean }) {
  const originalKey = useRef<string | null>(null);
  const [key, setKey] = useState("");
  const [state, setState] = useState<Availability | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let abort: AbortController | undefined;
    function openLink(initial = false) {
      const fragmentKey = new URLSearchParams(window.location.hash.slice(1)).get("clave");
      const secret = initial ? fragmentKey ?? originalKey.current : fragmentKey;
      originalKey.current = secret;
      window.history.replaceState(null, "", window.location.pathname);
      abort?.abort();
      setState(null); setError("");
      if (!validAvailabilityKey(secret)) { setKey(""); setBusy(false); return; }
      setKey(secret);
      if (!enabled) return;
      const current = new AbortController();
      abort = current;
      setBusy(true);
      fetch("/api/workers/availability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: secret, action: "status" }), signal: current.signal })
        .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); if (!current.signal.aborted) setState(body); })
        .catch(error => { if (!current.signal.aborted) setError(error.message || "No pudimos consultar tu disponibilidad."); })
        .finally(() => { if (!current.signal.aborted) setBusy(false); });
    }
    const onHashChange = () => openLink();
    openLink(true);
    window.addEventListener("hashchange", onHashChange);
    return () => { abort?.abort(); window.removeEventListener("hashchange", onHashChange); };
  }, [enabled]);
  async function renew(available: boolean) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/workers/availability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, action: "renew", available }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setState(body);
    } catch(error) { setError(error instanceof Error ? error.message : "No pudimos guardar el cambio. Intenta de nuevo."); }
    finally { setBusy(false); }
  }
  return <section className="request-builder">
    <h1>¿Estás disponible para trabajar?</h1>
    <p>Confirma en un paso, sin crear otro perfil. Tu confirmación dura 30 días; después debes renovarla. Puedes pausar en cualquier momento.</p>
    {!enabled ? <p role="status">La renovación todavía no está habilitada. Tu perfil y tus fotos se conservan.</p> : !key ? <p>Abre el enlace privado que recibiste después de verificar que el perfil es tuyo.</p> : <>
      <p role="status" aria-live="polite">{busy ? "Guardando o consultando…" : state?.fresh ? "Disponibilidad vigente por 30 días desde tu última confirmación." : state?.available ? "Tu disponibilidad venció. Confirma si puedes recibir solicitudes." : state ? "No estás marcado como disponible." : "Confirma tu disponibilidad para recibir solicitudes."}</p>
      <div className="request-actions"><button disabled={busy} className="btn-primary" onClick={() => renew(true)}>Sí, estoy disponible</button><button disabled={busy} className="btn-secondary" onClick={() => renew(false)}>Ahora no estoy disponible</button></div>
      <p>Esto no acepta ningún trabajo ni confirma un horario específico.</p>
    </>}
    {error && <p role="alert">{error}</p>}
    <p className="request-footnote">Guarda el enlace privado original. No lo compartas. Por seguridad, la clave se quita de la barra del navegador al abrirlo.</p>
    <Link className="btn-secondary" href="/trabajadores/recuperar">Necesito ayuda con mi acceso</Link>
  </section>;
}
