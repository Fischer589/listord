"use client";
import { useCallback, useEffect, useState } from "react";
import { ACTIVATION_INVITATION, type QueueReason } from "@/lib/activation-campaign";

type Row = {
  id: string; approved: boolean; ownerVerified: boolean; available: boolean;
  contactChannels: { whatsappCandidate: boolean };
  sharedContact: boolean; invitationPermission: boolean; invitationChannel: "whatsapp" | null;
  futureJobNotifications: { whatsapp: boolean }; deliveryStatus: string | null; reason: QueueReason;
};
type Data = { asOf: string; totals: Record<string, number>; rows: Row[];
  batches: { id: string; status: string; channel: string; max_recipients: number; cost_ceiling_cents: number; created_at: string }[] };
const reasonText: Record<QueueReason, string> = {
  eligible: "Elegible para revisión de lote", pending_approval: "Perfil sin aprobación",
  no_contact: "Sin teléfono válido", shared_contact: "Teléfono compartido: revisión",
  no_permission: "Falta permiso de invitación", suppressed: "Suprimido",
  opted_out: "Baja solicitada", unreachable: "Inalcanzable", already_batched: "Ya incluido en un lote"
};

export function AdminActivationQueue() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<QueueReason | "all">("all");
  const [page, setPage] = useState(0);
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [costCeiling, setCostCeiling] = useState("0");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/activation", { cache: "no-store", signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
  }, []);
  useEffect(() => { void load().catch(err => setError(err.message)); }, [load]);
  async function act(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/activation", { method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(12000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.batchId) setError(`Lote ${result.batchId} guardado para revisión. El envío permanece deshabilitado.`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "No se confirmó el cambio."); }
    finally { setBusy(false); }
  }
  const rows = (data?.rows ?? []).filter(row => filter === "all" || row.reason === filter);
  const visible = rows.slice(page * 50, (page + 1) * 50);
  const firstBatch = data?.rows.filter(row => row.reason === "eligible" && row.invitationChannel === "whatsapp").slice(0, 10) ?? [];
  return <section className="request-builder">
    <h1>Cola de activación de trabajadores</h1>
    <p>Incluye todos los perfiles. Los teléfonos permanecen privados. La existencia de un número no acredita permiso para invitar, titularidad ni disponibilidad.</p>
    {data ? <>
      <p role="status">Auditoría completa: {new Date(data.asOf).toLocaleString("es-DO")}</p>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(data.totals).map(([key, value]) => <div key={key} className="rounded-lg border p-3"><dt>{key}</dt><dd className="text-2xl font-black">{value}</dd></div>)}
      </dl>
      <section className="mt-5 rounded-lg border p-4">
        <h2>Primer lote controlado</h2>
        <p>Vista previa: {firstBatch.length} perfiles con permiso de invitación registrado, teléfono único y sin supresión. Máximo 10. Preparar solo guarda un borrador; no envía mensajes.</p>
        <p>Canal: WhatsApp</p>
        <label>Tope de costo en centavos <input type="number" min="0" max="1000000" value={costCeiling}
          onChange={event => setCostCeiling(event.target.value)} /></label>
        <button className="btn-primary" disabled={busy || !firstBatch.length || !/^\d+$/.test(costCeiling)}
          onClick={() => void act({ action: "prepare_batch", workerIds: firstBatch.map(row => row.id),
            channel: "whatsapp", costCeilingCents: Number(costCeiling) })}>Guardar lote para revisión</button>
        <details><summary>Texto de invitación aprobado para revisión</summary><pre className="whitespace-pre-wrap">{ACTIVATION_INVITATION}</pre></details>
        {data.batches.length > 0 && <div className="mt-4"><h3>Lotes guardados</h3>
          <ul>{data.batches.map(batch => <li key={batch.id}>{batch.id} · {batch.status} · {batch.channel} · {batch.max_recipients} perfiles · tope {batch.cost_ceiling_cents} centavos</li>)}</ul>
        </div>}
      </section>
      <div className="mt-5"><label>Filtrar por estado <select value={filter}
        onChange={event => { setFilter(event.target.value as QueueReason | "all"); setPage(0); }}>
        <option value="all">Todos</option>{Object.entries(reasonText).map(([value, label]) =>
          <option key={value} value={value}>{label}</option>)}</select></label></div>
      <p>{rows.length} perfiles en esta vista. Página {page + 1} de {Math.max(1, Math.ceil(rows.length / 50))}.</p>
      <div className="grid gap-3">{visible.map(row => <article key={row.id} className="rounded-lg border p-4">
        <p className="font-black">Perfil {row.id}</p>
        <p>{reasonText[row.reason]} · {row.ownerVerified ? "Titular vinculado" : "Titular sin verificar"} · {row.available ? "Disponible" : "No disponible confirmado"}</p>
        <p>Canal posible: {row.contactChannels.whatsappCandidate ? "WhatsApp (entrega sin verificar)" : "ninguno"}.
          Permiso de avisos futuros: {row.futureJobNotifications.whatsapp ? "WhatsApp" : "ninguno"}.</p>
        {row.deliveryStatus && <p>Entrega: {row.deliveryStatus}</p>}
        {!row.invitationPermission && row.reason !== "opted_out" && row.reason !== "suppressed" &&
          <div className="mt-2 flex flex-wrap gap-2"><input aria-label={`Referencia de permiso ${row.id}`}
            placeholder="Referencia privada de permiso explícito" value={evidence[row.id] ?? ""}
            onChange={event => setEvidence(current => ({ ...current, [row.id]: event.target.value }))} />
            <button className="btn-secondary" disabled={busy || !/^[A-Za-z0-9:_-]{5,160}$/.test(evidence[row.id] ?? "")}
              onClick={() => void act({ action: "permission", workerId: row.id, channel: "whatsapp", evidence: evidence[row.id], evidenceVerified: true })}>Registrar permiso revisado</button></div>}
        {row.reason !== "suppressed" && row.reason !== "opted_out" && <button className="btn-secondary"
          disabled={busy} onClick={() => void act({ action: "suppress", workerId: row.id, reason: "operator_hold" })}>Poner en espera</button>}
      </article>)}</div>
      <div className="request-actions"><button className="btn-secondary" disabled={page === 0}
        onClick={() => setPage(value => value - 1)}>Anterior</button><button className="btn-secondary"
        disabled={(page + 1) * 50 >= rows.length} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
    </> : <p role="status">Cargando auditoría…</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
