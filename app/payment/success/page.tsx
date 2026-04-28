"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import {
  BROWSER_SESSION_STORAGE_KEY,
  trackEvent
} from "@/lib/analytics";

export default function PaymentSuccessPage() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get(
      "session_id"
    );

    if (!sessionId) {
      setIsVerifying(false);
      return;
    }

    const verifiedSessionId = sessionId;
    let browserSessionId = "";

    try {
      browserSessionId = localStorage.getItem(BROWSER_SESSION_STORAGE_KEY) || "";
    } catch (error) {
      console.warn("Checkout success analytics session lookup failed.", error);
    }

    async function verifyPayment() {
      try {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const response = await fetch(
            `/api/stripe/verify?session_id=${encodeURIComponent(verifiedSessionId)}&browser_session_id=${encodeURIComponent(browserSessionId)}`
          );
          const data = (await response.json()) as {
            premium?: boolean;
            plan?: string | null;
            error?: string;
          };

          if (response.ok && data.premium) {
            setIsPremium(true);
            try {
              trackEvent("checkout_success", {
                plan: data.plan ?? null,
                checkout_session_id: verifiedSessionId
              });
            } catch (error) {
              console.warn("Checkout success analytics failed.", error);
            }
            return;
          }

          if (attempt === 5) {
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch {
        setIsPremium(false);
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
                : "Procesando tu acceso..."}
            </h1>
            <p className="mt-3 leading-7 text-black/70">
              {isVerifying
                ? "Procesando tu acceso..."
                : isPremium
                  ? "Tu acceso quedó activo en el servidor. Vuelve a la lista y continúa contactando por WhatsApp."
                  : "No pudimos verificar tu pago todavía. Intenta de nuevo o escríbenos por WhatsApp."}
            </p>
            {isPremium ? (
              <Link
                href="/"
                className="tap-target mt-6 inline-flex items-center justify-center rounded-md bg-hoja px-5 py-3 font-black text-white"
              >
                Ver trabajadores
              </Link>
            ) : (
              !isVerifying && (
                <Link
                  href="/"
                  className="tap-target mt-6 inline-flex items-center justify-center rounded-md bg-ink px-5 py-3 font-black text-white"
                >
                  Volver a intentar
                </Link>
              )
            )}
          </div>
        </section>
      </main>
    </>
  );
}
