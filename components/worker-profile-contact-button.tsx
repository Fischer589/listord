"use client";
import { useEffect, useState } from "react";
import { takeProfileRequest } from "@/lib/contact-context";
import { openFreeWorkerContact } from "@/lib/free-contact";
import type { RequestDraft } from "@/lib/request-specification";

export function WorkerProfileContactButton({ workerId, workerName, primarySkill }: { workerId: string; workerName: string; primarySkill: string }) {
  const [contactError, setContactError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestDraft, setRequestDraft] = useState<RequestDraft | null>(null);
  useEffect(() => { setRequestDraft(takeProfileRequest(workerId)); }, [workerId]);
  async function handleContact() {
    setLoading(true); setContactError("");
    try { await openFreeWorkerContact(workerId, workerName, primarySkill, requestDraft); }
    catch { setContactError("No pudimos abrir WhatsApp ahora mismo. Intenta de nuevo."); }
    finally { setLoading(false); }
  }
  return (
    <div className="rounded-2xl border border-[rgba(31,31,28,0.07)] bg-white p-5 shadow-soft">
      <p className="text-sm font-black uppercase tracking-wide text-hoja">
        Contactar
      </p>
      <p className="mt-2 text-sm font-bold text-ink/65">
        El contacto es gratis. Habla directo por WhatsApp.
      </p>

      <button
        type="button"
        onClick={handleContact}
        disabled={loading}
        className="tap-target mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f7a4c] px-4 py-4 text-lg font-black text-white shadow-[0_16px_34px_rgba(31,122,76,0.2)] hover:bg-[#17613c] disabled:opacity-70"
      >
        <WhatsAppIcon />
        {loading ? "Conectando..." : "Contactar por WhatsApp"}
      </button>
      <p className="mt-2 text-center text-xs font-bold text-ink/50">
        Mensaje directo — sin intermediarios
      </p>
      {contactError && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-center text-sm font-black text-red-700">
          {contactError}
        </p>
      )}

    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="h-5 w-5 shrink-0"
      fill="currentColor"
    >
      <path d="M16.03 3.5A12.38 12.38 0 0 0 5.44 22.3L4 28.5l6.36-1.38A12.36 12.36 0 1 0 16.03 3.5Zm0 22.5a10.05 10.05 0 0 1-5.12-1.4l-.36-.22-3.75.82.85-3.58-.24-.38A10.06 10.06 0 1 1 16.03 26Zm5.76-7.53c-.31-.16-1.85-.91-2.13-1.02-.29-.1-.49-.16-.7.16-.2.31-.8 1.02-.98 1.23-.18.2-.36.23-.67.08-.31-.16-1.32-.49-2.51-1.55a9.44 9.44 0 0 1-1.73-2.15c-.18-.31-.02-.48.14-.64.14-.14.31-.36.47-.54.16-.18.2-.31.31-.52.1-.2.05-.39-.03-.54-.08-.16-.7-1.68-.96-2.3-.25-.6-.51-.52-.7-.53h-.6c-.2 0-.54.08-.83.39-.29.31-1.09 1.06-1.09 2.59s1.12 3.01 1.27 3.22c.16.2 2.2 3.36 5.34 4.72.75.32 1.33.51 1.78.65.75.24 1.43.2 1.97.12.6-.09 1.85-.76 2.11-1.49.26-.73.26-1.35.18-1.49-.08-.13-.29-.2-.6-.36Z" />
    </svg>
  );
}
