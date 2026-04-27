"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";

const BROWSER_SESSION_STORAGE_KEY = "listord_browser_session_id";

export default function PaymentSuccessPage() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get(
      "session_id"
    );

    if (!sessionId) {
      setError("No pudimos verificar el pago.");
      setIsVerifying(false);
      return;
    }

    const verifiedSessionId = sessionId;
    const browserSessionId =
      localStorage.getItem(BROWSER_SESSION_STORAGE_KEY) || "";

    async function verifyPayment() {
      try {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const response = await fetch(
            `/api/stripe/verify?session_id=${encodeURIComponent(verifiedSessionId)}&browser_session_id=${encodeURIComponent(browserSessionId)}`
          );
          const data = (await response.json()) as {
            premium?: boolean;
            error?: string;
          };

          if (response.ok && data.premium) {
            setIsPremium(true);
            return;
          }

          if (attempt === 5) {
            setError(data.error || "No pudimos verificar el pago.");
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch {
        setError("No pudimos verificar el pago.");
      } finally {
        setIsVerifying(false);
      }
    }

    void verifyPayment();
  }, []);

  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <section className="container py-16">
          <div className="mx-auto max-w-xl rounded-xl border border-black/10 bg-white p-6 text-center shadow-soft">
            <p className="text-sm font-black uppercase tracking-wide text-hoja">
              {isPremium ? "Pago aprobado" : "Verificando pago"}
            </p>
            <h1 className="mt-2 text-3xl font-black text-ink">
              {isPremium
                ? "Ya puedes contactar trabajadores"
                : "Estamos confirmando tu acceso"}
            </h1>
            <p className="mt-3 leading-7 text-black/70">
              {isVerifying
                ? "Espera un momento mientras confirmamos el pago con Stripe."
                : isPremium
                  ? "Tu acceso quedó activo en el servidor. Vuelve a la lista y continúa contactando por WhatsApp."
                  : error}
            </p>
            {isPremium && (
              <Link
                href="/"
                className="tap-target mt-6 inline-flex items-center justify-center rounded-md bg-hoja px-5 py-3 font-black text-white"
              >
                Ver trabajadores
              </Link>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
