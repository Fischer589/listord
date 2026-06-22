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
  // Photo overlay shows primary skill; body shows supporting chips
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
    <article className="wc" ref={cardRef}>

      {/* ── Portrait photo ── */}
      <div className="wc-photo">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`Foto de ${fullName}`}
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 768px) 300px, 85vw"
            className="wc-photo-img"
            priority={false}
          />
        ) : (
          <div className="wc-photo-initials">{getInitials(fullName)}</div>
        )}

        {/* Featured badge */}
        {worker.is_featured && (
          <span
            className="wc-badge-new"
            style={{ background: "var(--green)", color: "#fff", top: "0.5rem", left: "0.5rem", right: "auto" }}
          >
            ⭐ Destacado
          </span>
        )}

        {/* New profile badge */}
        {!worker.is_featured && profileAge && (
          <span className="wc-badge-new">
            {profileAge === "today" ? "✦ Nuevo hoy" : "✦ Nuevo"}
          </span>
        )}
      </div>

      {/* ── Card body ── */}
      <div className="wc-body">

        {/* Availability — only shows "Disponible ahora" when explicitly true.
            available_now defaults to false in DB for all existing workers — never
            show "No disponible" as that is a false negative for workers who never
            set their availability. Neutral "Disponible" is the safe fallback. */}
        <div className="wc-avail">
          <span className="wc-avail-dot" />
          <span>
            {worker.available_now === true ? "Disponible ahora" : "Disponible"}
          </span>
        </div>

        {/* Identity */}
        <h2 className="wc-name">{fullName}</h2>
        <p className="wc-skill">{primarySkill}</p>
        {worker.city && (
          <p className="wc-city">
            {city}{worker.desired_income ? ` · ${formatIncomeShort(worker.desired_income)}` : ""}
          </p>
        )}

        {/* Social proof — rating + hired count */}
        {((worker.rating_average ?? 0) > 0 || (worker.hired_count ?? 0) > 0) && (
          <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", margin: "0.2rem 0 0" }}>
            {(worker.rating_average ?? 0) > 0 && (
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink)", opacity: 0.65 }}>
                ⭐ {worker.rating_average!.toFixed(1)}
              </span>
            )}
            {(worker.hired_count ?? 0) > 0 && (
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink)", opacity: 0.65 }}>
                ✓ {worker.hired_count} contrataci{worker.hired_count === 1 ? "ón" : "ones"}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="wc-actions">
          <button
            type="button"
            onClick={() => handleContactClick(worker)}
            className="tap-target wc-whatsapp-btn"
          >
            <WhatsAppIcon />
            Contactar por WhatsApp
          </button>
          <Link href={`/trabajador/${worker.id}`} className="wc-profile-link">
            Ver perfil completo →
          </Link>
        </div>

        {contactError && (
          <p className="wc-error">{contactError}</p>
        )}

        {/* ── Paywall Modal ── */}
        {showPaywall && (
          <div
            className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-3 sm:place-items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`paywall-title-${worker.id}`}
          >
            <div className="w-full max-w-md rounded-3xl border border-[rgba(31,31,28,0.06)] bg-[var(--surface-pure)] p-5 shadow-[var(--shadow-lg)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 text-center">
                  <h3
                    id={`paywall-title-${worker.id}`}
                    className="text-2xl font-black text-[var(--ink)]"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
                  >
                    Habla con trabajadores ahora
                  </h3>
                  <p className="mt-2 text-sm font-bold text-[var(--ink)]/65">
                    Ya usaste tu contacto gratis de hoy
                  </p>
                  <p className="mt-1 text-sm font-black text-[var(--green)]">
                    Solo RD$7 al día
                  </p>
                  <p className="mt-3 rounded-2xl border border-[rgba(31,31,28,0.06)] bg-[var(--green-bg)] p-3 text-sm font-bold leading-6 text-[var(--ink)]/75">
                    Contacto directo por WhatsApp con perfiles verificados que responden en minutos.
                  </p>
                  <p className="mt-3 rounded-2xl border border-[rgba(31,31,28,0.06)] bg-[var(--surface)] p-3 text-sm font-black text-[var(--ink)]">
                    Acceso sin compromisos — cancela cuando quieras
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaywall(false)}
                  className="tap-target rounded-lg px-3 text-2xl font-black text-[var(--ink)]/55 hover:bg-[var(--surface)]"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
              <div className="mt-5 grid gap-3">
                <label className="grid gap-1 text-left text-sm font-bold text-[var(--ink)]">
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
                  className="btn-primary tap-target p-4 text-center disabled:opacity-70"
                >
                  {checkoutPlan
                    ? "Procesando pago..."
                    : "Pagar con tarjeta — RD$99 / semana"}
                </button>
                <button
                  type="button"
                  onClick={() => handleStripeCheckout("monthly")}
                  disabled={checkoutPlan !== null}
                  className="btn-primary tap-target p-4 text-center disabled:opacity-70"
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
              <p className="mt-5 text-center text-xs font-bold text-[var(--ink)]/55">
                ¿Problemas con la tarjeta? Escríbenos para ayuda con el pago por transferencia.
              </p>
              <button
                type="button"
                onClick={handleWhatsAppPayment}
                className="btn-secondary tap-target mt-3 flex w-full items-center justify-center px-4 py-3"
              >
                Pagar por WhatsApp
              </button>
              <p className="mt-3 text-center text-xs font-bold text-[var(--ink)]/55">
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
