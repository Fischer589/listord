"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { formatIncomeShort, workStyleLabels } from "@/lib/format";
import type { Worker } from "@/lib/types";

const ADMIN_WHATSAPP_PHONE =
  process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_PHONE?.replace(/\D/g, "") ||
  "18090000000";
const WHATSAPP_PAYMENT_MESSAGE =
  "Hola, quiero pagar acceso a ListoRD por transferencia.";
const FREE_CONTACT_LIMIT = 2;
const BROWSER_SESSION_STORAGE_KEY = "listord_browser_session_id";

function getBrowserSessionId() {
  const existing = localStorage.getItem(BROWSER_SESSION_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(BROWSER_SESSION_STORAGE_KEY, id);

  return id;
}

export function WorkerCard({
  worker,
  unlocked = false
}: {
  worker: Worker;
  unlocked?: boolean;
}) {
  const fullName = worker.full_name || "Trabajador ListoRD";
  const city = worker.city || "República Dominicana";
  const skills = Array.isArray(worker.skills) ? worker.skills : [];
  const workStyle =
    worker.work_style && worker.work_style in workStyleLabels
      ? worker.work_style
      : null;
  const hiredCount = worker.hired_count ?? 0;
  const ratingAverage = worker.rating_average ?? 0;
  const ratingCount = worker.rating_count ?? 0;
  const [showPaywall, setShowPaywall] = useState(false);
  const [clicksUsed, setClicksUsed] = useState(0);
  const [checkoutPlan, setCheckoutPlan] = useState<
    "weekly" | "monthly" | null
  >(null);

  useEffect(() => {
    getBrowserSessionId();
    const current = Number(localStorage.getItem("contact_clicks") || 0);
    setClicksUsed(Number.isFinite(current) ? current : 0);
  }, []);

  const handleContactClick = async (selectedWorker: Worker) => {
    const browserSessionId = getBrowserSessionId();
    const current = Number(localStorage.getItem("contact_clicks") || 0);
    const isPremium = unlocked || (await hasActivePremiumAccess(browserSessionId));

    if (!isPremium && current >= FREE_CONTACT_LIMIT) {
      setShowPaywall(true);
      return;
    }

    if (!isPremium) {
      const next = current + 1;
      localStorage.setItem("contact_clicks", String(next));
      setClicksUsed(next);
    }

    await redirectToWhatsApp(selectedWorker);
  };

  async function hasActivePremiumAccess(browserSessionId: string) {
    try {
      const response = await fetch(
        `/api/premium/status?browser_session_id=${encodeURIComponent(browserSessionId)}`
      );
      const data = (await response.json()) as { premium?: boolean };

      return response.ok && data.premium === true;
    } catch {
      return false;
    }
  }

  async function handleStripeCheckout(plan: "weekly" | "monthly") {
    setCheckoutPlan(plan);
    const browserSessionId = getBrowserSessionId();

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          plan,
          browser_session_id: browserSessionId,
          client_reference_id: browserSessionId
        })
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        alert(data.error || "No se pudo iniciar el pago con tarjeta.");
        return;
      }

      window.location.href = data.url;
    } catch {
      alert("No se pudo iniciar el pago con tarjeta.");
    } finally {
      setCheckoutPlan(null);
    }
  }

  function handleWhatsAppPayment() {
    const message = encodeURIComponent(WHATSAPP_PAYMENT_MESSAGE);
    window.location.href =
      `https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP_PHONE}&text=${message}`;
  }

  async function redirectToWhatsApp(selectedWorker: Worker) {
    try {
      const response = await fetch("/api/workers/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workerId: selectedWorker.id })
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        alert(data.error || "No pudimos abrir WhatsApp.");
        return;
      }

      window.location.href = data.url;
    } catch {
      alert("No pudimos abrir WhatsApp.");
    }
  }

  return (
    <article className="worker-card">
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
            {fullName.charAt(0)}
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
              💰 Quiere {formatIncomeShort(worker.desired_income, worker.income_type)}
            </p>
          </div>
          <div className="pill-row mt-3 text-sm font-bold">
            <span
              className={
                worker.available_now
                  ? "rounded-md bg-hoja px-2 py-1 text-white"
                  : "rounded-md bg-[#f4f1ea] px-2 py-1 text-black/70"
              }
            >
              {worker.available_now ? "🟢 Disponible hoy" : "Disponible luego"}
            </span>
            <span
              className={
                worker.available_now
                  ? "rounded-md bg-mango/25 px-2 py-1 text-black/80"
                  : "rounded-md bg-[#f4f1ea] px-2 py-1 text-black/70"
              }
            >
              {worker.available_now
                ? "🔥 Responde en minutos"
                : "Agenda con anticipación"}
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

          <dl className="stats-grid mt-4 text-sm">
            <div className="rounded-md bg-cielo p-2">
              <dt className="font-semibold text-black/55">Ha sido contratado</dt>
              <dd className="font-black">
                {hiredCount} veces
              </dd>
            </div>
            <div className="rounded-md bg-cielo p-2">
              <dt className="font-semibold text-black/55">Valoración</dt>
              <dd className="font-black">
                {ratingAverage.toFixed(1)} ({ratingCount})
              </dd>
            </div>
          </dl>
        </div>

        <div className="contact-cta-shell">
          <button
            type="button"
            onClick={() => handleContactClick(worker)}
            className={`tap-target flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 font-black text-white ${
              unlocked ? "bg-hoja" : "bg-ink"
            }`}
          >
            <WhatsAppIcon />
            Contactar por WhatsApp
          </button>
          <p className="mt-2 text-center text-xs font-bold text-black/60">
            Respuesta promedio: &lt; 10 min
          </p>
          <p className="mt-1 text-center text-xs font-black text-black/70">
            Clicks usados: {clicksUsed} / {FREE_CONTACT_LIMIT}
          </p>
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
                    Solo RD$6 al día para contratar más rápido
                  </p>
                  <p className="mt-3 rounded-md bg-mango/20 p-3 text-sm font-bold leading-6 text-black/75">
                    Para proteger a los trabajadores, el contacto directo se
                    desbloquea después del pago.
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
                <button
                  type="button"
                  onClick={() => handleStripeCheckout("weekly")}
                  disabled={checkoutPlan !== null}
                  className="tap-target rounded-lg border-2 border-hoja bg-hoja p-4 text-center font-black text-white disabled:opacity-70"
                >
                  {checkoutPlan === "weekly"
                    ? "Abriendo pago..."
                    : "Pagar con tarjeta — RD$199 / semana"}
                </button>
                <button
                  type="button"
                  onClick={() => handleStripeCheckout("monthly")}
                  disabled={checkoutPlan !== null}
                  className="tap-target rounded-lg border-2 border-hoja bg-hoja p-4 text-center font-black text-white disabled:opacity-70"
                >
                  {checkoutPlan === "monthly"
                    ? "Abriendo pago..."
                    : "Pagar con tarjeta — RD$499 / mes"}
                </button>
              </div>
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
