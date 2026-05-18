"use client";

import { useState } from "react";
import { getBrowserSessionId, trackEvent } from "@/lib/analytics";
import { isValidWhatsAppUrl, normalizeWhatsAppNumber } from "@/lib/whatsapp";

const ADMIN_WHATSAPP_PHONE =
  process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_PHONE?.replace(/\D/g, "") ||
  "18090000000";
const CONTACT_ERROR_MESSAGE =
  "No pudimos abrir WhatsApp ahora mismo. Intenta de nuevo.";
const PAYMENT_ERROR_MESSAGE =
  "No pudimos iniciar el pago. Intenta de nuevo o escríbenos por WhatsApp.";
const INVALID_WHATSAPP_MESSAGE =
  "Escribe un WhatsApp válido para activar tu acceso.";

function buildWhatsAppUrlWithMessage(url: string, message: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("text", message);
    return parsed.toString();
  } catch {
    return url;
  }
}

export function WorkerProfileContactButton({
  workerId,
  workerName,
  primarySkill
}: {
  workerId: string;
  workerName: string;
  primarySkill: string;
}) {
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<"weekly" | "monthly" | null>(null);
  const [employerWhatsApp, setEmployerWhatsApp] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [contactError, setContactError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleContact() {
    setContactError("");
    setLoading(true);
    let sessionId = "";
    try {
      sessionId = getBrowserSessionId();
    } catch {
      // ignore
    }

    try {
      trackEvent("contact_click", { worker_id: workerId });
    } catch {
      // ignore
    }

    await doContact(sessionId);
    setLoading(false);
  }

  async function doContact(sessionId: string, whatsapp = employerWhatsApp) {
    try {
      const res = await fetch("/api/workers/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId,
          browser_session_id: sessionId,
          whatsapp_number: whatsapp
        })
      });

      let data: {
        url?: string;
        error?: string;
        reason?: string;
      } = {};
      try {
        data = await res.json();
      } catch {
        data = { error: CONTACT_ERROR_MESSAGE };
      }

      if (
        res.status === 402 ||
        data.reason === "paywall_required" ||
        data.reason === "payment_required"
      ) {
        try { trackEvent("paywall_open", { worker_id: workerId, reason: data.reason ?? "paywall_required" }); } catch { /* ignore */ }
        setShowPaywall(true);
        return;
      }

      const url = data.url;
      if (!res.ok || !url || !isValidWhatsAppUrl(url)) {
        setContactError(data.error || CONTACT_ERROR_MESSAGE);
        return;
      }

      const firstName = workerName.split(" ")[0] || "hola";
      const prefilledMessage = `Hola ${firstName}, te encontré en ListoRD. Necesito un(a) ${primarySkill}. ¿Estás disponible?`;
      window.open(buildWhatsAppUrlWithMessage(url, prefilledMessage), "_blank");
    } catch {
      setContactError(CONTACT_ERROR_MESSAGE);
    }
  }

  async function handleStripeCheckout(plan: "weekly" | "monthly") {
    setPaymentError("");
    const normalized = normalizeWhatsAppNumber(employerWhatsApp);
    if (!normalized) {
      setPaymentError(INVALID_WHATSAPP_MESSAGE);
      return;
    }
    setCheckoutPlan(plan);
    let sessionId = "";
    try { sessionId = getBrowserSessionId(); } catch { /* ignore */ }

    try {
      // Check premium status first
      const statusRes = await fetch(
        `/api/premium/status?browser_session_id=${encodeURIComponent(sessionId)}&whatsapp_number=${encodeURIComponent(normalized)}`
      );
      const statusData = await statusRes.json().catch(() => null) as { premium?: boolean } | null;
      if (statusRes.ok && statusData?.premium) {
        setCheckoutPlan(null);
        setShowPaywall(false);
        await doContact(sessionId, normalized);
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          browser_session_id: sessionId,
          client_reference_id: sessionId,
          whatsapp_number: normalized
        })
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setPaymentError(PAYMENT_ERROR_MESSAGE);
        setCheckoutPlan(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setPaymentError(PAYMENT_ERROR_MESSAGE);
      setCheckoutPlan(null);
    }
  }

  function handleWhatsAppPayment() {
    window.open(`https://wa.me/${ADMIN_WHATSAPP_PHONE}`, "_blank");
  }

  return (
    <div className="rounded-2xl border border-[rgba(31,31,28,0.07)] bg-white p-5 shadow-soft">
      <p className="text-sm font-black uppercase tracking-wide text-hoja">
        Contactar
      </p>
      <p className="mt-2 text-sm font-bold text-ink/65">
        Tu primer contacto del día es gratis. Habla directo por WhatsApp.
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

      {showPaywall && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-3 sm:place-items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`paywall-profile-${workerId}`}
        >
          <div className="w-full max-w-md rounded-3xl border border-[rgba(31,31,28,0.06)] bg-card p-5 shadow-lift">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 text-center">
                <h3
                  id={`paywall-profile-${workerId}`}
                  className="text-2xl font-black text-ink"
                >
                  Habla con trabajadores ahora
                </h3>
                <p className="mt-2 text-sm font-bold text-ink/65">
                  Ya usaste tu contacto gratis de hoy
                </p>
                <p className="mt-1 text-sm font-black text-hoja">Solo RD$7 al día</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaywall(false)}
                className="tap-target rounded-lg px-3 text-2xl font-black text-ink/55 hover:bg-crema"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <label className="grid gap-1 text-left text-sm font-bold text-ink">
                Tu WhatsApp
                <input
                  className="premium-input tap-target"
                  value={employerWhatsApp}
                  onChange={(e) => setEmployerWhatsApp(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="8091234567 o +12675160983"
                />
              </label>
              <button
                type="button"
                onClick={() => handleStripeCheckout("weekly")}
                disabled={checkoutPlan !== null}
                className="btn-primary tap-target p-4 text-center text-white disabled:opacity-70"
              >
                {checkoutPlan ? "Procesando pago..." : "Pagar con tarjeta — RD$99 / semana"}
              </button>
              <button
                type="button"
                onClick={() => handleStripeCheckout("monthly")}
                disabled={checkoutPlan !== null}
                className="btn-primary tap-target p-4 text-center text-white disabled:opacity-70"
              >
                {checkoutPlan ? "Procesando pago..." : "Pagar con tarjeta — RD$199 / mes"}
              </button>
            </div>
            {paymentError && (
              <p className="mt-3 rounded-md bg-red-50 p-3 text-center text-sm font-black text-red-700">
                {paymentError}
              </p>
            )}
            <button
              type="button"
              onClick={handleWhatsAppPayment}
              className="btn-secondary tap-target mt-4 flex w-full items-center justify-center px-4 py-3"
            >
              Pagar por WhatsApp
            </button>
            <p className="mt-3 text-center text-xs font-bold text-ink/55">
              Sin compromiso. Cancela cuando quieras.
            </p>
          </div>
        </div>
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
