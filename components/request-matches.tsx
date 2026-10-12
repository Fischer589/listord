"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { storeProfileRequest } from "@/lib/contact-context";
import type { MatchResult } from "@/lib/request-matching";
import type { RequestDraft } from "@/lib/request-specification";

export function RequestMatches({ draft }: { draft: RequestDraft }) {
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contacting, setContacting] = useState<string | null>(null);
  const [contactError, setContactError] = useState("");
  const [visible, setVisible] = useState(20);
  const enteredAt = useRef(Date.now());
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function search() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true); setError(""); setContactError(""); setResult(null); setVisible(20);
    try {
      const response = await fetch("/api/requests/matches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft), signal: abort.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error("matching unavailable");
      if (!abort.signal.aborted) { setResult(body as MatchResult); trackEvent("request_matches", { elapsed_ms: Date.now() - enteredAt.current, match_count: body.count }); }
    } catch {
      if (!abort.signal.aborted) setError("No pudimos verificar los perfiles. Intenta de nuevo; no significa que no haya trabajadores.");
    } finally { if (!abort.signal.aborted) setLoading(false); }
  }
  async function contact(id: string) {
    const abort = new AbortController();
    controller.current = abort;
    setContacting(id); setContactError("");
    try {
      const response = await fetch("/api/requests/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, workerId: id }), signal: abort.signal,
      });
      const body = await response.json();
      if (!response.ok) { setContactError(body.error || "No pudimos preparar el contacto."); return; }
      const url = new URL(body.url);
      if (url.protocol !== "https:" || url.hostname !== "wa.me") throw new Error("Invalid handoff");
      if (!abort.signal.aborted) { trackEvent("request_contact", { elapsed_ms: Date.now() - enteredAt.current }); window.location.assign(url.toString()); }
    } catch { if (!abort.signal.aborted) setContactError("No pudimos preparar el contacto. Intenta de nuevo."); }
    finally { setContacting(null); }
  }
  return <section className="request-matches" aria-label="Trabajadores compatibles">
    <h2>Encuentra a quién contactar.</h2>
    <p>Buscar y contactar desde estos resultados es gratis.</p>
    <button className="btn-primary" disabled={loading || contacting !== null} onClick={search}>{loading ? "Verificando perfiles…" : result ? "Actualizar resultados" : "Buscar trabajadores compatibles"}</button>
    <div aria-live="polite" aria-busy={loading}>
      {error && <p role="alert">{error}</p>}
      {result && <>
        <h3>Encontramos {result.count} trabajadores compatibles</h3>
        <p>Coinciden en oficio, ciudad y disponibilidad declarada. No han confirmado interés ni el horario, los requisitos o todas las tareas de tu solicitud.</p>
        <p>{result.freshness === "confirmed" ? `Solo incluimos perfiles aprobados que renovaron su disponibilidad en los últimos ${result.windowDays} días. La disponibilidad vencida o pausada queda fuera.` : `Solo incluimos perfiles aprobados creados en los últimos ${result.windowDays} días que indican disponibilidad. Los antiguos o con datos faltantes quedan fuera hasta renovar esa información.`}</p>
        {result.count === 0 && <p className="request-empty">No encontramos perfiles que cumplan estos criterios. Puede haber personas con disponibilidad desconocida o perfiles antiguos. Puedes editar tu solicitud o explorar el directorio; no enviaremos invitaciones ni cobraremos.</p>}
        {result.workers.length > 0 && <ul className="request-match-list">{result.workers.slice(0, visible).map(worker => <li key={worker.id}>
          <h3>{worker.name}</h3><p>{worker.city}</p>
          <p>{worker.reasons.join(" · ")}</p>
          {worker.scopeEvidence.length > 0 && <p>Habilidades que aparecen en tu alcance: {worker.scopeEvidence.join(", ")}</p>}
          <div className="request-actions"><Link className="btn-secondary" href={`/trabajador/${worker.id}`} onClick={() => storeProfileRequest(draft, worker.id)}>Ver perfil</Link><Link className="btn-secondary" href={`/empleadores/mi-cuenta?worker=${encodeURIComponent(worker.id)}`}>Guardar en mi espacio</Link><button className="btn-primary" disabled={contacting !== null} onClick={() => contact(worker.id)}>{contacting === worker.id ? "Preparando contacto…" : "Contactar gratis por WhatsApp"}</button></div>
        </li>)}</ul>}
        {result.count > visible && <button className="btn-secondary" onClick={() => setVisible(previous => previous + 20)}>Ver más perfiles</button>}
        <div className="request-express">
          <h3>ListoRD Express</h3>
          <p>¿Quieres saber quiénes están disponibles e interesados?</p>
          <p>Cuando esté habilitado, Express contactará a los trabajadores compatibles y organizará sus respuestas. Tú eliges con quién hablar. No garantiza una contratación.</p>
          <strong>RD$299 — Pago único</strong>
          <button className="btn-primary" disabled aria-describedby="express-unavailable">ENCONTRAR PERSONAL AHORA</button>
          <p id="express-unavailable">Próximamente. Los pagos y el envío de invitaciones aún no están habilitados. No se realizará ningún cobro.</p>
        </div>
      </>}
    </div>
    {contactError && <p role="alert">{contactError}</p>}
  </section>;
}
