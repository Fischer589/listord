import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function OutcomeThanksPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-soft">
          <p className="text-sm font-black uppercase tracking-wide text-hoja">
            Gracias
          </p>
          <h1 className="mt-2 text-3xl font-black">Respuesta recibida</h1>
          <p className="mt-3 leading-7 text-black/70">
            Tu respuesta ayuda a mejorar la confianza en la plataforma.
          </p>
          <Link
            href="/"
            className="tap-target mt-5 inline-flex items-center rounded-md bg-ink px-4 py-3 font-black text-white"
          >
            Volver a ListoRD
          </Link>
        </section>
      </main>
    </>
  );
}
