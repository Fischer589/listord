"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getBrowserSessionId, trackEvent } from "@/lib/analytics";
import { formatIncomeShort, workStyleLabels } from "@/lib/format";
import type { Worker } from "@/lib/types";

const ADMIN_WHATSAPP_PHONE =
  process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_PHONE?.replace(/\D/g, "") ||
  "18090000000";
const WHATSAPP_PAYMENT_MESSAGE =
  "Hola, quiero pagar acceso a ListoRD por transferencia.";
const CONTACT_ERROR_MESSAGE =
  "No pudimos abrir WhatsApp ahora mismo. Intenta de nuevo.";
const PAYMENT_ERROR_MESSAGE =
  "No pudimos iniciar el pago. Intenta de nuevo o escríbenos por WhatsApp.";

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "LR";
}

export function WorkerCard({
  worker
}: {
  worker: Worker;
}) {
  const fullName = worker.full_name || "Trabajador ListoRD";
  const city = worker.city || "República Dominicana";
  const skills = Array.isArray(worker.skills) ? worker.skills : [];
  const workStyle =
    worker.work_style && worker.work_style in workStyleLabels
      ? worker.work_style
      : null;
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<
    "weekly" | "monthly" | null
  >(null);
  const [employerWhatsAppNumber, setEmployerWhatsAppNumber] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [contactError, setContactError] = useState("");
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      getBrowserSessionId();
    } catch (error) {
      console.warn("Browser session analytics setup failed.", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    }
  }, []);

  useEffect(() => {
    const card = cardRef.current;

    if (!card) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        try {
          trackEvent("worker_view", {
            worker_id: worker.id
          });
        } catch (error) {
          console.warn("Worker view analytics failed.", {
            name: error instanceof Error ? error.name : "UnknownError"
          });
        }
        observer.disconnect();
      },
      { threshold: 0.5 }
    );

    observer.observe(card);

    return () => observer.disconnect();
  }, [worker.id]);

  const handleContactClick = async (selectedWorker: Worker) => {
    let browserSessionId = "";

    try {
      browserSessionId = getBrowserSessionId();
    } catch (error) {
      console.warn("Browser session analytics lookup failed.", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    }

    setContactError("");
    try {
      trackEvent("contact_click", {
        worker_id: selectedWorker.id
      });
    } catch (error) {
      console.warn("Contact click analytics failed.", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    }

    await redirectToWhatsApp(selectedWorker, browserSessionId);
  };

  async function handleStripeCheckout(plan: "weekly" | "monthly") {
    setCheckoutPlan(plan);
    setPaymentError("");
    let browserSessionId = "";

    try {
      browserSessionId = getBrowserSessionId();
    } catch (error) {
      console.warn("Browser session analytics lookup failed.", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    }

    try {
      trackEvent("checkout_start", {
        plan
      });
    } catch (error) {
      console.warn("Checkout start analytics failed.", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          plan,
          browser_session_id: browserSessionId,
          client_reference_id: browserSessionId,
          whatsapp_number: employerWhatsAppNumber
        })
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
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
    const message = encodeURIComponent(WHATSAPP_PAYMENT_MESSAGE);
    window.location.href =
      `https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP_PHONE}&text=${message}`;
  }

  async function redirectToWhatsApp(
    selectedWorker: Worker,
    browserSessionId: string
  ) {
    try {
      const response = await fetch("/api/workers/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          workerId: selectedWorker.id,
          browser_session_id: browserSessionId,
          whatsapp_number: employerWhatsAppNumber
        })
      });
      const data = (await response.json()) as {
        url?: string;
        error?: string;
        reason?: string;
      };

      if (response.status === 402 || data.reason === "payment_required") {
        try {
          trackEvent("paywall_open", {
            worker_id: selectedWorker.id,
            reason: data.reason ?? "payment_required"
          });
        } catch (error) {
          console.warn("Paywall analytics failed.", {
            name: error instanceof Error ? error.name : "UnknownError"
          });
        }
        setShowPaywall(true);
        return;
      }

      if (!response.ok || !data.url) {
        setContactError(CONTACT_ERROR_MESSAGE);
        return;
      }

      window.location.href = data.url;
    } catch {
      setContactError(CONTACT_ERROR_MESSAGE);
    }
  }

  return (
    <article className="worker-card" ref={cardRef}>
      <div className="worker-photo">
        {worker.photo_url ? (
          <Image
            src={worker.photo_url}
            alt={`Foto de ${fullName}`}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover object-center"
            priority={false}
          />
        ) : (
          <div className="grid h-full place-items-center text-4xl font-black text-hoja">
            {getInitials(fullName)}
          </div>
        )}
      </div>

      <div className="worker-main flex flex-1 flex-col">
        <div className="flex-1">
          <div>
            <h2 className="worker-name text-ink">
              {fullName}
            </h2>
            <p className="worker-income text-ink">
              💰 Quiere {formatIncomeShort(worker.desired_income)}
            </p>
            <p className="mt-2 rounded-md bg-mango/20 px-3 py-2 text-sm font-black text-ink">
              Quedan pocos trabajadores disponibles hoy
            </p>
          </div>
          <div className="pill-row mt-3 text-sm font-bold">
            <span className="rounded-md bg-mango/25 px-2 py-1 text-black/80">
              Responden por WhatsApp
            </span>
            <span className="rounded-md bg-cielo px-2 py-1 text-black/80">
              Perfiles verificados
            </span>
            <span className="rounded-md bg-[#f4f1ea] px-2 py-1 text-black/75">
              {city}
            </span>
          </div>

          <div className="pill-row mt-4">
            {skills.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="rounded-md bg-mango/20 px-2 py-1 text-xs font-bold text-ink"
              >
                {skill}
              </span>
            ))}
            {workStyle && (
              <span className="rounded-md bg-cielo px-2 py-1 text-xs font-bold text-ink">
                Estilo: {workStyleLabels[workStyle]}
              </span>
            )}
          </div>

          {worker.short_intro && (
            <p className="worker-bio mt-4 text-sm leading-6 text-black/70">
              {worker.short_intro}
            </p>
          )}
        </div>

        <div className="contact-cta-shell">
          <button
            type="button"
            onClick={() => handleContactClick(worker)}
            className="tap-target whatsapp-cta flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-4 font-black text-white"
          >
            <WhatsAppIcon />
            Contactar por WhatsApp
          </button>
          <p className="mt-2 text-center text-xs font-black text-black/70">
            Contacto directo por WhatsApp
          </p>
          <p className="mt-1 text-center text-xs font-bold text-black/60">
            Responden en menos de 10 minutos
          </p>
          {contactError && (
            <p className="mt-2 rounded-md bg-red-50 p-2 text-center text-xs font-black text-red-700">
              {contactError}
            </p>
          )}
        </div>

        {showPaywall && (
          <div
            className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-3 sm:place-items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`paywall-title-${worker.id}`}
          >
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 text-center">
                  <h3
                    id={`paywall-title-${worker.id}`}
                    className="text-2xl font-black text-ink"
                  >
                    Habla con trabajadores ahora
                  </h3>
                  <p className="mt-2 text-sm font-bold text-black/65">
                    Ya usaste tus 2 contactos gratis
                  </p>
                  <p className="mt-1 text-sm font-black text-hoja">
                    Solo RD$6 al día
                  </p>
                  <p className="mt-3 rounded-md bg-mango/20 p-3 text-sm font-bold leading-6 text-black/75">
                    Contacto directo por WhatsApp con perfiles verificados que
                    responden en minutos.
                  </p>
                  <p className="mt-3 rounded-md bg-cielo p-3 text-sm font-black text-ink">
                    Quedan pocos trabajadores disponibles hoy
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaywall(false)}
                  className="tap-target rounded-md px-3 text-2xl font-black text-black/55"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
              <div className="mt-5 grid gap-3">
                <label className="grid gap-1 text-left text-sm font-bold text-ink">
                  Tu WhatsApp
                  <input
                    className="tap-target rounded-md border border-black/15 px-3"
                    value={employerWhatsAppNumber}
                    onChange={(event) =>
                      setEmployerWhatsAppNumber(event.target.value)
                    }
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="809, 829 o 849..."
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleStripeCheckout("weekly")}
                  disabled={checkoutPlan !== null}
                  className="tap-target rounded-lg border-2 border-hoja bg-hoja p-4 text-center font-black text-white disabled:opacity-70"
                >
                  {checkoutPlan
                    ? "Procesando pago..."
                    : "Pagar con tarjeta — RD$199 / semana"}
                </button>
                <button
                  type="button"
                  onClick={() => handleStripeCheckout("monthly")}
                  disabled={checkoutPlan !== null}
                  className="tap-target rounded-lg border-2 border-hoja bg-hoja p-4 text-center font-black text-white disabled:opacity-70"
                >
                  {checkoutPlan
                    ? "Procesando pago..."
                    : "Pagar con tarjeta — RD$499 / mes"}
                </button>
              </div>
              {paymentError && (
                <p className="mt-3 rounded-md bg-red-50 p-3 text-center text-sm font-black text-red-700">
                  {paymentError}
                </p>
              )}
              <p className="mt-5 text-center text-xs font-bold text-black/55">
                ¿Problemas con la tarjeta? Escríbenos para ayuda con el pago
                por transferencia.
              </p>
              <button
                type="button"
                onClick={handleWhatsAppPayment}
                className="tap-target mt-3 flex w-full items-center justify-center rounded-md border-2 border-black/10 bg-[#f4f1ea] px-4 py-3 font-black text-ink"
              >
                Pagar por WhatsApp
              </button>
              <p className="mt-3 text-center text-xs font-bold text-black/55">
                Sin compromiso. Cancela cuando quieras.
              </p>
            </div>
          </div>
        )}
      </div>
    </article>
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
