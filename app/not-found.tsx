import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function NotFoundPage() {
  return (
    <>
      <AppHeader />
      <main className="container py-10">
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-soft">
          <p className="text-sm font-black uppercase tracking-wide text-hoja">
            404
          </p>
          <h1 className="mt-2 text-3xl font-black">Página no encontrada</h1>
          <p className="mt-3 max-w-xl leading-7 text-black/70">
            Esa página no existe o ya no está disponible.
          </p>
          <Link
            href="/"
            className="tap-target mt-5 inline-flex items-center rounded-md bg-ink px-4 py-3 font-black text-white"
          >
            Volver al inicio
          </Link>
        </section>
      </main>
    </>
  );
}
