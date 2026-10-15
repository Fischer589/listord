"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { storeProfileRequest } from "@/lib/contact-context";
import { openFreeWorkerContact } from "@/lib/free-contact";
import { ContactPaywall } from "@/components/contact-paywall";
import { formatIncomeShort, workStyleLabels } from "@/lib/format";
import type { RequestDraft } from "@/lib/request-specification";
import type { Worker } from "@/lib/types";
const FALLBACK_PRIMARY_SKILL = "Perfil de trabajador";

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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
    if (!Number.isFinite(diffMs) || diffMs < 0) return null;
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

// ─── Component ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function WorkerCard({ worker, requestDraft = null }: { worker: Worker; requestDraft?: RequestDraft | null }) {
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
  const [contactError, setContactError] = useState("");
  const [contacting, setContacting] = useState(false);
  const [paywall, setPaywall] = useState(false);
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

  async function handleContactClick(selectedWorker: Worker) {
    setContactError(""); setContacting(true);
    try { if (await openFreeWorkerContact(selectedWorker.id, requestDraft) === "paywall") setPaywall(true); }
    catch { setContactError("No pudimos abrir WhatsApp ahora mismo. Intenta de nuevo."); }
    finally { setContacting(false); }
  }

  // ── Render ───────────────────────────────────────────────────────────────────────────────────────────────────

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

        {/* New profile badge */}
        {profileAge && (
          <span className="wc-badge-new">
            {profileAge === "today" ? "✦ Nuevo hoy" : "✦ Nuevo"}
          </span>
        )}
      </div>

      {/* ── Card body ── */}
      <div className="wc-body">

        <div className="wc-avail">
          <span className="wc-avail-dot" />
          <span>
            {worker.available_now === true ? "Disponibilidad histórica; confirma con la persona" : "Disponibilidad por confirmar"}
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
            disabled={contacting}
            className="tap-target wc-whatsapp-btn"
          >
            <WhatsAppIcon />
            Contactar trabajador
          </button>
          <Link href={`/trabajador/${worker.id}`} onClick={() => { if (requestDraft) storeProfileRequest(requestDraft, worker.id); }} className="wc-profile-link">
            Ver perfil completo →
          </Link>
          <Link href={`/empleadores/mi-cuenta?worker=${encodeURIComponent(worker.id)}`} className="wc-profile-link">
            Guardar en mi espacio →
          </Link>
        </div>

        {contactError && (
          <p className="wc-error">{contactError}</p>
        )}
        {paywall && <ContactPaywall workerId={worker.id} occupation={skills[0]} city={worker.city} onClose={() => setPaywall(false)} />}


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
