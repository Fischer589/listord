"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import {
  BROWSER_SESSION_STORAGE_KEY,
  trackEvent
} from "@/lib/analytics";

type VerifyResult = {
  premium: boolean;
  plan: string | null;
  paid_access_until?: string | null;
  free_contacts_remaining?: number | null;
};

const PLAN_LABEL: Record<string, string> = {
  weekly:  "Semanal",
  monthly: "Mensual",
};
const PLAN_DURATION: Record<string, string> = {
  weekly:  "7 días",
  monthly: "30 días",
};

export default function PaymentSuccessPage() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get(
      "session_id"
    );

    if (!sessionId) {
      setIsVerifying(false);
      return;
    }

    let browserSessionId = "";
    try {
      browserSessionId =
        localStorage.getItem(BROWSER_SESSION_STORAGE_KEY) || "";
    } catch (error) {
      console.warn("Checkout success session lookup failed.", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    }

    async function verifyPayment() {
      try {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const response = await fetch(
            `/api/stripe/verify?session_id=${encodeURIComponent(
              sessionId!
            )}&browser_session_id=${encodeURIComponent(browserSessionId)}`
          );
          const data = (await response.json()) as {
            premium?: boolean;
            plan?: string | null;
            paid_access_until?: string | null;
            free_contacts_remaining?: number | null;
            error?: string;
          };

          if (response.ok && data.premium) {
            setResult({
              premium: true,
              plan: data.plan ?? null,
              paid_access_until: data.paid_access_until,
              free_contacts_remaining: data.free_contacts_remaining,
            });
            try {
              trackEvent("checkout_success", {
                plan: data.plan ?? null,
                checkout_session_id: sessionId!
              });
            } catch (error) {
              console.warn("Checkout success analytics failed.", {
                name: error instanceof Error ? error.name : "UnknownError"
              });
            }
            return;
          }

          if (attempt === 5) {
            setResult({ premium: false, plan: null });
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch {
        setResult({ premium: false, plan: null });
      } finally {
        setIsVerifying(false);
      }
    }

    void verifyPayment();
  }, []);

  const planLabel    = result?.plan ? (PLAN_LABEL[result.plan]    ?? result.plan) : null;
  const planDuration = result?.plan ? (PLAN_DURATION[result.plan] ?? null)         : null;

  const expiryDisplay = result?.paid_access_until
    ? new Date(result.paid_access_until).toLocaleDateString("es-DO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : planDuration
    ? `aprox. ${planDuration}`
    : null;

  return (
    <>
      <AppHeader />
      <main
        className="page-shell"
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <section
          className="container"
          style={{ maxWidth: "520px", padding: "3rem 1.25rem", textAlign: "center" }}
        >
          {isVerifying ? (
            <>
              <p style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⏳</p>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.8rem",
                  fontWeight: 400,
                  color: "var(--ink)",
                }}
              >
                Verificando pago...
              </h1>
              <p style={{ color: "rgba(26,61,43,0.55)", marginTop: "0.5rem" }}>
                Esto tarda unos segundos.
              </p>
            </>
          ) : result?.premium ? (
            <>
              <p style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✅</p>
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--green)",
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "0.4rem",
                }}
              >
                Acceso activado
              </p>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.75rem, 4vw, 2.4rem)",
                  fontWeight: 400,
                  color: "var(--ink)",
                  marginBottom: "1.25rem",
                }}
              >
                Ya puedes contactar trabajadores
              </h1>

              {/* Plan details row */}
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: "1rem",
                  padding: "0.75rem 1.25rem",
                  marginBottom: "1.5rem",
                  textAlign: "left",
                }}
              >
                {planLabel && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.35rem 0",
                      borderBottom: "1px solid rgba(26,61,43,0.07)",
                    }}
                  >
                    <span style={{ fontSize: "0.875rem", color: "rgba(26,61,43,0.55)" }}>
                      Plan
                    </span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--ink)" }}>
                      {planLabel}
                    </span>
                  </div>
                )}
                {expiryDisplay && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.35rem 0",
                      borderBottom: planLabel ? undefined : "none",
                    }}
                  >
                    <span style={{ fontSize: "0.875rem", color: "rgba(26,61,43,0.55)" }}>
                      Válido por
                    </span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--ink)" }}>
                      {expiryDisplay}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.35rem 0",
                  }}
                >
                  <span style={{ fontSize: "0.875rem", color: "rgba(26,61,43,0.55)" }}>
                    Contactos hoy
                  </span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--green)" }}>
                    Ilimitados
                  </span>
                </div>
              </div>

              <Link href="/" className="btn-primary tap-target">
                Ver trabajadores →
              </Link>
              <p
                style={{
                  marginTop: "1rem",
                  fontSize: "0.78rem",
                  color: "rgba(26,61,43,0.4)",
                }}
              >
                Contacto directo por WhatsApp. Sin intermediarios.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚠️</p>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.8rem",
                  fontWeight: 400,
                  color: "var(--ink)",
                  marginBottom: "0.75rem",
                }}
              >
                No pudimos verificar el pago aún
              </h1>
              <p
                style={{
                  color: "rgba(26,61,43,0.55)",
                  maxWidth: "400px",
                  margin: "0 auto 1.5rem",
                  lineHeight: 1.6,
                }}
              >
                Si ya completaste el pago, espera un minuto y vuelve a intentar.
                Si el problema persiste, escríbenos por WhatsApp.
              </p>
              <Link href="/" className="btn-primary tap-target">
                Volver al inicio
              </Link>
            </>
          )}
        </section>
      </main>
    </>
  );
}
