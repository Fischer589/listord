"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { storeDiscoveryRequest } from "@/lib/contact-context";
import { RequestMatches } from "./request-matches";
import { MarketplacePublication } from "./marketplace-publication";
import { parseMatchRequest } from "@/lib/request-matching";
import { CATEGORIES } from "@/lib/categories";
import { CITIES } from "@/lib/cities";
import { changeCategory, COMPENSATION_UNITS, emptyRequest, REQUEST_SCHEMAS, RequestDraft, RequestErrors, requestSummary, validateRequest } from "@/lib/request-specification";
import { takePendingPublicationDraft } from "@/lib/pending-publication-draft";

const STEPS = ["Servicio y lugar", "Alcance", "Fecha y pago", "Tu solicitud"];

export function RequestBuilder({ publicationEnabled = false }: { publicationEnabled?: boolean }) {
  const [draft, setDraft] = useState(emptyRequest);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [errors, setErrors] = useState<RequestErrors>({});
  const [copyStatus, setCopyStatus] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const enteredAt = useRef(Date.now());
  const previewed = useRef(false);
  useEffect(() => {
    const startedAt = enteredAt.current;
    trackEvent("request_started");
    return () => { if (!previewed.current) trackEvent("request_abandoned", { elapsed_ms: Date.now() - startedAt }); };
  }, []);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("listord-reuse-request-v1");
      const reusable = saved ? parseMatchRequest(JSON.parse(saved)) : takePendingPublicationDraft();
      if (saved) sessionStorage.removeItem("listord-reuse-request-v1");
      if (reusable) { setDraft(reusable); setStep(3); }
    } catch { /* A blocked store never prevents anonymous intake. */ }
  }, []);
  useEffect(() => {
    if (step === 3) { previewed.current = true; trackEvent("request_preview", { elapsed_ms: Date.now() - enteredAt.current }); }
    if (mounted.current) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
    mounted.current = true;
  }, [step]);
  useEffect(() => { if (Object.keys(errors).length) errorBox.current?.focus(); }, [errors]);
  function update<K extends keyof RequestDraft>(key: K, value: RequestDraft[K]) {
    setDraft(previous => ({ ...previous, [key]: value }));
    setCopyStatus("");
  }
  function go(next: 0 | 1 | 2 | 3) { setErrors({}); setCopyStatus(""); setStep(next); }
  function next(event: FormEvent) {
    event.preventDefault();
    if (step === 3) return;
    const found = validateRequest(draft, step);
    setErrors(found);
    if (!Object.keys(found).length) go((step + 1) as 1 | 2 | 3);
  }
  function error(id: string) {
    return errors[id] ? <span className="request-error" id={`${id}-error`}>{errors[id]}</span> : null;
  }
  function attrs(id: string) {
    return { id, "aria-invalid": Boolean(errors[id]), "aria-describedby": errors[id] ? `${id}-error` : undefined };
  }
  async function copy() {
    try { await navigator.clipboard.writeText(requestSummary(draft)); setCopyStatus("Resumen copiado."); }
    catch { setCopyStatus("No pudimos copiarlo. Puedes seleccionar el resumen y copiarlo manualmente."); }
  }
  return <div className="request-builder">
    <nav aria-label="Progreso de la solicitud"><ol className="request-steps">{STEPS.map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined}><span>{i + 1}</span>{label}</li>)}</ol></nav>
    <h1 ref={heading} tabIndex={-1}>{["¿Qué necesitas? ¿Dónde?", "Lo esencial para decirte que sí.", "Pongamos los términos claros.", "Así se verá tu solicitud."][step]}</h1>
    <p className="request-intro">{step === 0 ? "Cuéntanos qué necesitas y dónde. Después podrás revisar perfiles gratis y elegir a quién contactar." : step === 3 ? "Revisa los detalles antes de compartirlos. Este borrador todavía no está publicado ni enviado." : "Solo lo necesario para que la persona entienda el trabajo."}</p>
    {Object.keys(errors).length > 0 && <div className="request-error-box" ref={errorBox} tabIndex={-1} role="alert">Revisa los campos indicados. Tus respuestas siguen aquí.</div>}
    {step < 3 ? <form onSubmit={next} noValidate>
      {step === 0 && <div className="request-fields">
        <label htmlFor="category">¿Qué necesitas?<select {...attrs("category")} value={draft.category} onChange={e => setDraft(previous => changeCategory(previous, e.target.value))}><option value="">Elige un servicio</option>{CATEGORIES.map(c => <option key={c.searchKey} value={c.searchKey}>{c.label}</option>)}</select>{error("category")}</label>
        <label htmlFor="city">¿Dónde?<input {...attrs("city")} list="request-cities" autoComplete="address-level2" value={draft.city} maxLength={100} placeholder="Ciudad o municipio" onChange={e => update("city", e.target.value)} /><datalist id="request-cities">{CITIES.map(c => <option key={c.slug} value={c.name} />)}</datalist>{error("city")}</label>
        <p>Usa la ciudad o municipio. No escribas una dirección residencial exacta.</p>
      </div>}
      {step === 1 && <div className="request-fields">
        <p className="request-context">{CATEGORIES.find(c => c.searchKey === draft.category)?.label} · {draft.city}</p>
        {(REQUEST_SCHEMAS[draft.category] ?? []).map(q => <label key={q.id} htmlFor={q.id}>{q.label}{q.optional ? " (opcional)" : ""}
          {q.options ? <select {...attrs(q.id)} value={draft.answers[q.id] ?? ""} onChange={e => update("answers", { ...draft.answers, [q.id]: e.target.value })}><option value="">Elige una opción</option>{q.options.map(option => <option key={option}>{option}</option>)}</select> : <textarea {...attrs(q.id)} rows={2} maxLength={300} value={draft.answers[q.id] ?? ""} onChange={e => update("answers", { ...draft.answers, [q.id]: e.target.value })} />}{error(q.id)}</label>)}
        <p>No incluyas teléfonos, direcciones exactas, nombres de menores ni información médica privada.</p>
      </div>}
      {step === 2 && <div className="request-fields">
        <label htmlFor="timing">Fecha y horario<input {...attrs("timing")} maxLength={200} placeholder="Ej.: 15 de octubre, 9:00 a. m.; o fecha flexible" value={draft.timing} onChange={e => update("timing", e.target.value)} />{error("timing")}</label>
        <label htmlFor="duration">Duración o frecuencia<input {...attrs("duration")} maxLength={200} placeholder="Ej.: 4 horas; o a estimar tras la visita" value={draft.duration} onChange={e => update("duration", e.target.value)} />{error("duration")}</label>
        <label htmlFor="compensation">Pago<select {...attrs("compensation")} value={draft.compensation} onChange={e => update("compensation", e.target.value as RequestDraft["compensation"])}><option value="budget">Tengo un presupuesto</option><option value="fixed">Ofrezco un pago fijo</option><option value="negotiable">Por acordar con la persona</option></select>{error("compensation")}</label>
        {draft.compensation !== "negotiable" && <div className="request-pair"><label htmlFor="amount">Monto en RD$<input {...attrs("amount")} inputMode="decimal" maxLength={10} value={draft.amount} onChange={e => update("amount", e.target.value)} />{error("amount")}</label><label htmlFor="unit">Unidad<select {...attrs("unit")} value={draft.unit} onChange={e => update("unit", e.target.value)}>{COMPENSATION_UNITS.map(unit => <option key={unit}>{unit}</option>)}</select>{error("unit")}</label></div>}
        <label htmlFor="exclusions">Tareas que no incluye (opcional)<textarea {...attrs("exclusions")} rows={2} maxLength={300} value={draft.exclusions} onChange={e => update("exclusions", e.target.value)} />{error("exclusions")}</label>
        <label htmlFor="requirements">Requisitos indispensables (opcional)<textarea {...attrs("requirements")} rows={2} maxLength={300} placeholder="Ej.: licencia de conducir vigente" value={draft.requirements} onChange={e => update("requirements", e.target.value)} />{error("requirements")}</label>
      </div>}
      <div className="request-actions">{step > 0 && <button type="button" className="btn-secondary" onClick={() => go((step - 1) as 0 | 1)}>Atrás</button>}<button type="submit" className="btn-primary">{step === 2 ? "Ver mi solicitud" : "Continuar"}</button></div>
    </form> : <>
      <article className="request-preview" aria-label="Resumen de la solicitud"><p>{requestSummary(draft)}</p></article>
      <div className="request-actions" aria-label="Editar solicitud"><button className="btn-secondary" onClick={() => go(0)}>Editar servicio y lugar</button><button className="btn-secondary" onClick={() => go(1)}>Editar alcance</button><button className="btn-secondary" onClick={() => go(2)}>Editar fecha y pago</button></div>
      <div className="request-actions"><button className="btn-primary" onClick={copy}>Copiar resumen</button><Link className="btn-secondary" href={`/?${new URLSearchParams({ skill: draft.category, city: draft.city }).toString()}#descubre`} onClick={event => storeDiscoveryRequest(draft, event.currentTarget.href)}>Explorar perfiles</Link></div>
      <p role="status">{copyStatus}</p>
      <RequestMatches draft={draft} />
      {publicationEnabled && <MarketplacePublication draft={draft} />}
      <p>Explorar perfiles filtra por servicio y ciudad. No confirma disponibilidad ni interés en esta solicitud.</p>
    </>}
    <p className="request-footnote">Intentaremos conservar el borrador en esta pestaña mientras verificas tu correo. Copia el resumen si usarás otro dispositivo.</p>
  </div>;
}
