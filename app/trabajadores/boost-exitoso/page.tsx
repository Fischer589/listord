"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BoostStatus = "checking" | "paid" | "pending" | "failed" | "unknown";

export default function BoostSuccessPage({
  searchParams
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams?.session_id;
  const [status, setStatus] = useState<BoostStatus>("checking");

  useEffect(() => {
    if (!sessionId) {
      setStatus("unknown");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    // The frontend NEVER activates the boost — it only polls the
    // read-only status endpoint while the webhook (source of truth)
    // finishes processing, which is normally near-instant.
    async function poll() {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/stripe/boost-status?session_id=${encodeURIComponent(sessionId!)}`
        );
        const data = (await response.json().catch(() => null)) as {
          status?: string;
        } | null;

        if (cancelled) return;

        if (data?.status === "paid") {
          setStatus("paid");
          return;
        }

        if (attempts < 8) {
          setTimeout(poll, 1500);
        } else {
          setStatus("pending");
        }
      } catch {
        if (!cancelled) setStatus("unknown");
      }
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <main
      className="page-shell"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div className="container" style={{ maxWidth: "520px", textAlign: "center", padding: "3rem 1.5rem" }}>
        <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>🚀</p>

        {status === "paid" && (
          <>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
                fontWeight: 400,
                color: "var(--ink)",
                marginBottom: "0.75rem"
              }}
            >
              ¡Tu perfil está impulsado!
            </h1>
            <p style={{ color: "rgba(26,61,43,0.65)", fontSize: "1.05rem", marginBottom: "2rem", lineHeight: 1.6 }}>
              Tu perfil ahora tiene mayor visibilidad para los empleadores durante las próximas 24 horas.
            </p>
          </>
        )}

        {(status === "checking" || status === "pending") && (
          <>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
                fontWeight: 400,
                color: "var(--ink)",
                marginBottom: "0.75rem"
              }}
            >
              Confirmando tu pago...
            </h1>
            <p style={{ color: "rgba(26,61,43,0.65)", fontSize: "1.05rem", marginBottom: "2rem", lineHeight: 1.6 }}>
              Esto normalmente toma unos segundos. Si tu pago fue exitoso, tu perfil se impulsará automáticamente.
            </p>
          </>
        )}

        {(status === "failed" || status === "unknown") && (
          <>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
                fontWeight: 400,
                color: "var(--ink)",
                marginBottom: "0.75rem"
              }}
            >
              No pudimos confirmar tu pago todavía
            </h1>
            <p style={{ color: "rgba(26,61,43,0.65)", fontSize: "1.05rem", marginBottom: "2rem", lineHeight: 1.6 }}>
              Si Stripe confirmó tu pago, tu perfil se impulsará en breve. Si tienes dudas, escríbenos por WhatsApp.
            </p>
          </>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/" className="btn-primary tap-target">
            Ver mi perfil en ListoRD
          </Link>
        </div>

        <p style={{ marginTop: "2rem", fontSize: "0.8rem", color: "rgba(26,61,43,0.45)" }}>
          Recibirás un correo de confirmación de Stripe.
        </p>
      </div>
    </main>
  );
}
