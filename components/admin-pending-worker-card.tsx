"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const OpenConfirmation = createContext<(() => void) | null>(null);

export function RejectWorkerButton() {
  const open = useContext(OpenConfirmation);
  if (!open) throw new Error("RejectWorkerButton requires PendingWorkerCard");
  return <button type="button" onClick={open}
    className="tap-target rounded-md border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-700 hover:bg-red-100">
    Rechazar y eliminar
  </button>;
}

export function PendingWorkerCard({ workerId, workerName, children }: {
  workerId: string;
  workerName: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState("");

  async function reject() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/workers", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", workerId, confirmId: workerId }),
        signal: AbortSignal.timeout(12000)
      });
      if (response.redirected) throw new Error("La sesión de administración venció. Inicia sesión de nuevo.");
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "No se pudo eliminar el registro.");
      if (result?.deleted !== true || result.workerId !== workerId) {
        throw new Error("La eliminación no fue confirmada. Actualiza la página.");
      }
      setRemoved(true);
      router.refresh();
    } catch (cause) {
      setConfirmOpen(false);
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar el registro.");
    } finally {
      setBusy(false);
    }
  }

  if (removed) return null;
  return <OpenConfirmation.Provider value={() => { setError(""); setConfirmOpen(true); }}>
    <article data-worker-id={workerId} className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
      {children}
      {error && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      {confirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div role="dialog" aria-modal="true" aria-labelledby={`reject-title-${workerId}`}
          aria-describedby={`reject-description-${workerId}`}
          onKeyDown={event => { if (event.key === "Escape" && !busy) setConfirmOpen(false); }}
          className="w-full max-w-md rounded-xl bg-white p-6 shadow-lift">
          <h2 id={`reject-title-${workerId}`} className="text-xl font-black text-ink">¿Eliminar definitivamente este registro?</h2>
          <p id={`reject-description-${workerId}`} className="mt-3 text-sm text-black/70">
            Se eliminarán permanentemente el registro pendiente de {workerName} y su entrada de activación sin actividad. Esta acción no se puede deshacer. Si hay historial protegido, no se eliminará nada.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void reject()}
              className="tap-target rounded-md bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {busy ? "Rechazando…" : "Sí, rechazar y eliminar"}
            </button>
            <button type="button" autoFocus disabled={busy} onClick={() => setConfirmOpen(false)}
              className="tap-target rounded-md border border-black/15 bg-white px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">Cancelar</button>
          </div>
        </div>
      </div>}
    </article>
  </OpenConfirmation.Provider>;
}
