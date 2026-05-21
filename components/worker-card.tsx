"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getBrowserSessionId, trackEvent } from "@/lib/analytics";
import { formatIncomeShort, workStyleLabels } from "@/lib/format";
import type { Worker } from "@/lib/types";
import {
  buildWhatsAppUrl,
  isValidWhatsAppUrl,
  normalizeWhatsAppNumber
} from "@/lib/whatsapp";

const ADMIN_WHATSAPP_PHONE =
  process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_PHONE?.replace(/\D/g, "") ||
  "18090000000";
const CONTACT_ERROR_MESSAGE =
  "No pudimos abrir WhatsApp ahora mismo. Intenta de nuevo.";
const PAYMENT_ERROR_MESSAGE =
  "No pudimos iniciar el pago. Intenta de nuevo o escríbenos por WhatsApp.";
const INVALID_WHATSAPP_MESSAGE =
  "Escribe un WhatsApp válido para activar tu acceso.";
const FALLBACK_PRIMARY_SKILL = "Trabajador disponible";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWorkerSkills(worker: Worker) {
  return Array.isArray(worker.skills)
    ? worker.skills.map((skill) => skill.trim()).filter(Boolean)
    : [];
}

function getPrimarySkill(skills: string[]) {
  return skills[0] || FALLBACK_PRIMARY_SKILL;
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "LR";
}

/** Appends a pre-filled message to a wa.me URL */
function buildWhatsAppUrlWithMessage(url: string, message: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("text", message);
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Returns the profile age bucket:
 * - "today"  : registered within the last 24 hours
 * - "week"   : registered within the last 7 days
 * - null     : older than 7 days or unknown
 */
function getProfileAge(createdAt: string | undefined): "today" | "week" | null {
  if (!createdAt) return null;
  try {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (diffMs < ONE_DAY) return "today";
    if (diffMs < 7 * ONE_DAY) return "week";
    return null;
  } catch {
    return null;
  }
}

/** Returns true if the worker has a complete profile (photo + intro + 2 skills) */
function hasCompleteProfile(worker: Worker): boolean {
  return Boolean(
    worker.photo_url?.trim() &&
      worker.short_intro?.trim() &&
      Array.isArray(worker.skills) &&
      worker.skills.length >= 2
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkerCard({ worker }: { worker: Worker }) {
  const fullName = worker.full_name || "Trabajador ListoRD";
  const photoUrl = worker.photo_url?.trim();
  const city = worker.city || "República Dominicana";
  const skills = getWorkerSkills(worker);
  const primarySkill = getPrimarySkill(skills);
  // Show primary skill in header; supporting skills as chips (skip first)
  const chipSkills = skills.slice(1, 4);
  const overflowCount = Math.max(0, skills.length - 1 - chipSkills.length);
  const workStyle =
    worker.work_style && worker.work_style in workStyleLabels
      ? worker.work_style
      : null;

  const profileAge = getProfileAge(worker.created_at);
  const isComplete = hasCompleteProfile(worker);

  // ── State ──
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<"weekly" | "monthly" | null>(null);
  const [employerWhatsAppNumber, setEmployerWhatsAppNumber] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [contactError, setContactError] = useState("");
  const cardRef = useRef<HTMLElement | null>(null);

  // ── Analytics ──
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        try {
          trackEvent("worker_view", { worker_id: worker.id });
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

  // ── Handlers (ALL UNTOUCHED) ──

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
      trackEvent("contact_click", { worker_id: selectedWorker.id });
    } catch (error) {
      console.warn("Contact click analytics failed.", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    }
    await redirectToWhatsApp(selectedWorker, browserSessionId);
  };

  async function handleStripeCheckout(plan: "weekly" | "monthly") {
    setPaymentError("");
    const normalizedEmployerWhatsApp = normalizeWhatsAppNumber(employerWhatsAppNumber);
    if (!normalizedEmployerWhatsApp) {
      setPaymentError(INVALID_WHATSAPP_MESSAGE);
      return;
    }
    setCheckoutPlan(plan);
    let browserSessionId = "";
    try {
      browserSessionId = getBrowserSessionId();
    } catch (error) {
      console.warn("Browser session analytics lookup failed.", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    }
    try {
      trackEvent("checkout_start", { plan });
    } catch (error) {
      console.warn("Checkout start analytics failed.", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    }
    try {
      const statusResponse = await fetch(
        `/api/premium/status?browser_session_id=${encodeURIComponent(
          browserSessionId
        )}&whatsapp_number=${encodeURIComponent(normalizedEmployerWhatsApp)}`
      );
      const statusData = (await statusResponse.json().catch(() => null)) as {
        premium?: boolean;
      } | null;
      if (statusResponse.ok && statusData?.premium) {
        setEmployerWhatsAppNumber(normalizedEmployerWhatsApp);
        setCheckoutPlan(null);
        setShowPaywall(false);
        await redirectToWhatsApp(worker, browserSessionId, normalizedEmployerWhatsApp);
        return;
      }
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          browser_session_id: browserSessionId,
          client_reference_id: browserSessionId,
          whatsapp_number: normalizedEmployerWhatsApp
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
    const url = buildWhatsAppUrl(ADMIN_WHATSAPP_PHONE);
    if (!url || !isValidWhatsAppUrl(url)) {
      setPaymentError(PAYMENT_ERROR_MESSAGE);
      return;
    }
    window.open(url, "_blank");
  }

  async function redirectToWhatsApp(
    selectedWorker: Worker,
    browserSessionId: string,
    whatsappNumber = employerWhatsAppNumber
  ) {
    try {
      const response = await fetch("/api/workers/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: selectedWorker.id,
          browser_session_id: browserSessionId,
          whatsapp_number: whatsappNumber
        })
      });
      let data: {
        url?: string;
        error?: string;
        reason?: string;
        free_contacts_remaining?: number;
      };
      try {
        data = (await response.json()) as typeof data;
      } catch {
        data = { error: CONTACT_ERROR_MESSAGE };
      }
      if (
        response.status === 402 ||
        data.reason === "paywall_required" ||
        data.reason === "payment_required"
      ) {
        try {
          trackEvent("paywall_open", {
            worker_id: selectedWorker.id,
            reason: data.reason ?? "paywall_required"
          });
        } catch (error) {
          console.warn("Paywall analytics failed.", {
            name: error instanceof Error ? error.name : "UnknownError"
          });
        }
        setShowPaywall(true);
        return;
      }
      const contactUrl = data.url;
      if (!response.ok || !contactUrl || !isValidWhatsAppUrl(contactUrl)) {
        setContactError(data.error || CONTACT_ERROR_MESSAGE);
        return;
      }
      const workerName = selectedWorker.full_name?.split(" ")[0] || "hola";
      const workerSkills = getWorkerSkills(selectedWorker);
      const skill = getPrimarySkill(workerSkills);
      const prefilledMessage = `Hola ${workerName}, te encontré en ListoRD. Necesito un(a) ${skill}. ¿Estás disponible?`;
      const finalUrl = buildWhatsAppUrlWithMessage(contactUrl, prefilledMessage);
      window.open(finalUrl, "_blank");
    } catch (error) {
      setContactError(
        error instanceof Error ? error.message : CONTACT_ERROR_MESSAGE
      );
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <article className="worker-card" ref={cardRef}>
      {/* ── Photo ── */}
      <div className="worker-photo">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`Foto de ${fullName}`}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="worker-photo-image"
            priority={false}
          />
        ) : (
          <div className="worker-photo-fallback">{getInitials(fullName)}</div>
        )}
        {/* Activity badge — "Nuevo hoy" or "Nuevo" */}
        {profileAge && (
          <span className="worker-badge-new">
            {profileAge === "today" ? "✦ Nuevo hoy" : "✦ Nuevo"}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="worker-main flex flex-1 flex-col">
        <div className="flex-1">

          {/* Name + verification row */}
          <div className="worker-name-row">
            <div className="min-w-0 flex-1">
              <h2 className="worker-name text-ink">{fullName}</h2>
              <p className="worker-primary-skill" title={primarySkill}>
                <span className="worker-primary-skill-text">{primarySkill}</span>
              </p>
            </div>
            <span className="worker-verified-pill">✓</span>
          </div>

          {/* City + rate info row */}
          <div className="worker-info-row">
            <span className="worker-city-label">
              <svg aria-hidden="true" viewBox="0 0 16 16" className="worker-city-icon" fill="currentColor">
                <path d="M8 1.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM2 6a6 6 0 1 1 10.74 3.67l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04A6 6 0 0 1 2 6Z"/>
              </svg>
              {city}
            </span>
            <span className="worker-rate-label">
              {formatIncomeShort(worker.desired_income)}
            </span>
          </div>

          {/* Bio */}
          {worker.short_intro && (
            <p className="worker-bio line-clamp-2">{worker.short_intro}</p>
          )}

          {/* Skill chips */}
          {(chipSkills.length > 0 || workStyle) && (
            <div className="worker-chips-row">
              {chipSkills.map((skill) => (
                <span key={skill} className="worker-skill-chip">{skill}</span>
              ))}
              {overflowCount > 0 && (
                <span className="worker-skill-more">+{overflowCount}</span>
              )}
              {workStyle && chipSkills.length === 0 && (
                <span className="worker-skill-chip">
                  {workStyleLabels[workStyle]}
                </span>
              )}
            </div>
          )}

          {/* Profile quality signal */}
          {isComplete && (
            <p className="worker-complete-signal">✓ Perfil completo</p>
          )}
        </div>

        {/* Availability + profile link footer */}
        <div className="worker-card-footer">
          <div className="worker-availability">
            <span className="worker-avail-dot" aria-hidden="true" />
            Disponible hoy
          </div>
          <Link
            href={`/trabajador/${worker.id}`}
            className="worker-profile-link"
          >
            Ver perfil →
          </Link>
        </div>

        {/* ── WhatsApp CTA ── */}
        <div className="contact-cta-shell">
          <button
            type="button"
            onClick={() => handleContactClick(worker)}
            className="tap-target whatsapp-cta flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f7a4c] px-4 py-4 font-black text-white hover:bg-[#17613c]"
          >
            <WhatsAppIcon />
            Contactar por WhatsApp
          </button>
          <p className="mt-2 text-center text-xs font-bold text-ink/50">
            Mensaje directo — sin intermediarios
          </p>
          {contactError && (
            <p className="mt-2 rounded-lg bg-red-50 p-2 text-center text-xs font-black text-red-700">
              {contactError}
            </p>
          )}
        </div>

        {/* ── Paywall Modal (unchanged) ── */}
        {showPaywall && (
          <div
            className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-3 sm:place-items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`paywall-title-${worker.id}`}
          >
            <div className="w-full max-w-md rounded-3xl border border-[rgba(31,31,28,0.06)] bg-card p-5 shadow-lift">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 text-center">
                  <h3
                    id={`paywall-title-${worker.id}`}
                    className="text-2xl font-black text-ink"
                  >
                    Habla con trabajadores ahora
                  </h3>
                  <p className="mt-2 text-sm font-bold text-ink/65">
                    Ya usaste tu contacto gratis de hoy
                  </p>
                  <p className="mt-1 text-sm font-black text-hoja">
                    Solo RD$7 al día
                  </p>
                  <p className="mt-3 rounded-2xl border border-[rgba(31,31,28,0.06)] bg-hoja/10 p-3 text-sm font-bold leading-6 text-ink/75">
                    Contacto directo por WhatsApp con perfiles verificados que
                    responden en minutos.
                  </p>
                  <p className="mt-3 rounded-2xl border border-[rgba(31,31,28,0.06)] bg-cielo p-3 text-sm font-black text-ink">
                    Acceso sin compromisos — cancela cuando quieras
                  </p>
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
                    value={employerWhatsAppNumber}
                    onChange={(event) =>
                      setEmployerWhatsAppNumber(event.target.value)
                    }
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
                  {checkoutPlan
                    ? "Procesando pago..."
                    : "Pagar con tarjeta — RD$99 / semana"}
                </button>
                <button
                  type="button"
                  onClick={() => handleStripeCheckout("monthly")}
                  disabled={checkoutPlan !== null}
                  className="btn-primary tap-target p-4 text-center text-white disabled:opacity-70"
                >
                  {checkoutPlan
                    ? "Procesando pago..."
                    : "Pagar con tarjeta — RD$199 / mes"}
                </button>
              </div>
              {paymentError && (
                <p className="mt-3 rounded-md bg-red-50 p-3 text-center text-sm font-black text-red-700">
                  {paymentError}
                </p>
              )}
              <p className="mt-5 text-center text-xs font-bold text-ink/55">
                ¿Problemas con la tarjeta? Escríbenos para ayuda con el pago
                por transferencia.
              </p>
              <button
                type="button"
                onClick={handleWhatsAppPayment}
                className="btn-secondary tap-target mt-3 flex w-full items-center justify-center px-4 py-3"
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
