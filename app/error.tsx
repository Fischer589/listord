"use client";

import { AppHeader } from "@/components/app-header";

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <AppHeader />
      <main className="container py-10">
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-soft">
          <p className="text-sm font-black uppercase tracking-wide text-hoja">
            Algo falló
          </p>
          <h1 className="mt-2 text-3xl font-black">
            No pudimos cargar esta parte de ListoRD
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-black/70">
            Intenta otra vez. Si sigue pasando, vuelve en unos minutos.
          </p>
          <button
            onClick={reset}
            className="tap-target mt-5 rounded-md bg-ink px-4 py-3 font-black text-white"
          >
            Intentar de nuevo
          </button>
        </section>
      </main>
    </>
  );
}
