"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { BROWSER_SESSION_STORAGE_KEY } from "@/lib/analytics";

type StatusData = {
  premium: boolean;
  plan?: string | null;
  paid_access_until?: string | null;
  free_contacts_remaining?: number | null;
};

const PLAN_LABEL: Record<string, string> = {
  weekly:  "Semanal (7 días)",
  monthly: "Mensual (30 días)",
};

export default function EmployerAccountPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let browserSessionId = "";
    try {
      browserSessionId =
        localStorage.getItem(BROWSER_SESSION_STORAGE_KEY) || "";
    } catch {}

    if (!browserSessionId) {
      setLoading(false);
      return;
    }

    async function fetchStatus() {
      try {
        const response = await fetch(
          `/api/premium/status?browser_session_id=${encodeURIComponent(
            browserSessionId
          )}`
        );
        if (!response.ok) { setLoading(false); return; }
        const data = (await response.json()) as StatusData;
        setStatus(data);
      } catch {
        // noop — show "no data" state
      } finally {
        setLoading(false);
      }
    }

    void fetchStatus();
  }, []);

  const expiryDisplay = status?.paid_access_until
    ? new Date(status.paid_access_until).toLocaleDateString("es-DO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      <AppHeader />
      <main className="page-shell" style={{ minHeight: "80vh" }}>
        <div className="container" style={{ maxWidth: "540px", padding: "3rem 1.25rem" }}>

          {/* Breadcrumb */}
          <nav style={{ marginBottom: "1.5rem", fontSize: "0.85rem", color: "rgba(26,61,43,0.5)" }}>
            <Link href="/empleadores" style={{ color: "var(--green)", fontWeight: 600 }}>
              Empleadores
            </Link>
            {" ›"} Mi cuenta
          </nav>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
              fontWeight: 400,
              color: "var(--ink)",
              marginBottom: "0.5rem",
            }}
          >
            Mi cuenta
          </h1>
          <p style={{ color: "rgba(26,61,43,0.55)", marginBottom: "2rem" }}>
            Estado de tu acceso en este navegador.
          </p>

          {loading ? (
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "1rem",
                padding: "2rem",
                textAlign: "center",
                color: "rgba(26,61,43,0.45)",
              }}
            >
              Cargando...
            </div>
          ) : !status ? (
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "1rem",
                padding: "2rem",
                textAlign: "center",
              }}
            >
              <p style={{ color: "rgba(26,61,43,0.55)", marginBottom: "1.25rem" }}>
                No encontramos una sesión activa en este navegador.
                Usa el mismo dispositivo y navegador donde realizaste tu pago.
              </p>
              <Link href="/" className="btn-primary tap-target">
                Buscar trabajadores
              </Link>
            </div>
          ) : (
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "1rem",
                overflow: "hidden",
              }}
            >
              {/* Status header */}
              <div
                style={{
                  background: status.premium ? "var(--green)" : "rgba(26,61,43,0.06)",
                  padding: "1rem 1.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <span style={{ fontSize: "1.5rem" }}>
                  {status.premium ? "✅" : "🆓"}
                </span>
                <div>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: "1rem",
                      color: status.premium ? "#fff" : "var(--ink)",
                    }}
                  >
                    {status.premium ? "Acceso Premium activo" : "Plan gratuito"}
                  </p>
                  {status.premium && status.plan && (
                    <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.75)", marginTop: "0.1rem" }}>
                      {PLAN_LABEL[status.plan] ?? status.plan}
                    </p>
                  )}
                </div>
              </div>

              {/* Status details */}
              <div style={{ padding: "1.25rem 1.5rem" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {status.premium && expiryDisplay && (
                      <tr style={{ borderBottom: "1px solid rgba(26,61,43,0.07)" }}>
                        <td style={{ padding: "0.6rem 0", fontSize: "0.875rem", color: "rgba(26,61,43,0.55)" }}>
                          Acceso hasta
                        </td>
                        <td style={{ padding: "0.6rem 0", fontSize: "0.875rem", fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>
                          {expiryDisplay}
                        </td>
                      </tr>
                    )}
                    <tr style={{ borderBottom: "1px solid rgba(26,61,43,0.07)" }}>
                      <td style={{ padding: "0.6rem 0", fontSize: "0.875rem", color: "rgba(26,61,43,0.55)" }}>
                        Contactos hoy
                      </td>
                      <td style={{ padding: "0.6rem 0", fontSize: "0.875rem", fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>
                        {status.premium
                          ? "Ilimitados"
                          : `${status.free_contacts_remaining ?? 0} gratis restantes`}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "0.6rem 0", fontSize: "0.875rem", color: "rgba(26,61,43,0.55)" }}>
                        Acceso vía
                      </td>
                      <td style={{ padding: "0.6rem 0", fontSize: "0.875rem", fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>
                        Este navegador
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <Link href="/" className="btn-primary tap-target" style={{ flex: 1, textAlign: "center" }}>
                    Ver trabajadores →
                  </Link>
                </div>

                {!status.premium && (
                  <p style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "rgba(26,61,43,0.45)", textAlign: "center" }}>
                    Con Premium puedes contactar trabajadores sin límite diario.
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
