"use client";

import { useState } from "react";

const GENERIC_ERROR =
  "No pudimos iniciar el pago. Intenta de nuevo o escríbenos por WhatsApp.";

export function BoostProfileButton({
  editToken,
  label = "🚀 Impulsar mi perfil — RD$100"
}: {
  editToken: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/stripe/boost-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edit_token: editToken })
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
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="tap-target inline-flex w-full items-center justify-center rounded-xl bg-[#1f7a4c] px-4 py-3 text-center font-black text-white disabled:opacity-60 sm:w-fit"
      >
        {loading ? "Abriendo pago..." : label}
      </button>
      {error && (
        <p className="mt-2 text-sm font-bold text-red-900">{error}</p>
      )}
    </div>
  );
}
