"use client";

import Link from "next/link";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";

const GENERIC_ERROR =
  "No pudimos iniciar el pago. Intenta de nuevo o escríbenos por WhatsApp.";

export default function EmployerDepositPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/stripe/employer-deposit-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const data = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.url) {
        setError(data?.error || GENERIC_ERROR);
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError(GENERIC_ERROR);
      setLoading(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <section className="container max-w-2xl py-8">
          <Link href="/" className="text-sm font-bold text-hoja">
            ← Volver al inicio
          </Link>

          <div className="mt-4 rounded-2xl border border-hoja/20 bg-cielo/50 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-hoja">
              Para empleadores
            </p>
            <h1 className="mt-2 text-3xl font-black text-ink">
              Activa tu búsqueda de personal
            </h1>
            <p className="mt-2 leading-7 text-ink/70">
              Realiza tu depósito de RD$3,000 pesos dominicanos para iniciar el
              proceso de búsqueda y conexión con trabajadores disponibles a
              través de ListoRD.
            </p>
          </div>

          <div className="mt-5 grid w-full min-w-0 gap-5 overflow-hidden rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-cielo/40 p-4">
              <div className="min-w-0">
                <p className="font-black text-ink">
                  Depósito de búsqueda de personal ListoRD
                </p>
                <p className="mt-1 text-sm font-semibold text-ink/60">
                  Pago único · Procesado de forma segura por Stripe
                </p>
              </div>
              <p className="shrink-0 text-2xl font-black text-ink">RD$3,000 DOP</p>
            </div>

            {error && (
              <div className="min-w-0 break-words rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handlePay}
              disabled={loading}
              className="tap-target w-full min-w-0 rounded-2xl bg-gradient-to-br from-ink to-[#2d4a1e] px-4 py-4 text-lg font-black text-white shadow-[0_16px_40px_rgba(29,29,27,0.22)] hover:shadow-[0_20px_50px_rgba(29,29,27,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Abriendo pago..." : "Pagar depósito de RD$3,000"}
            </button>

            <p className="min-w-0 break-words text-center text-xs font-semibold text-black/50">
              Serás redirigido a la página segura de pago de Stripe.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
