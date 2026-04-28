import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function PaymentCancelPage() {
  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <section className="container py-16">
          <div className="mx-auto max-w-xl rounded-xl border border-black/10 bg-white p-6 text-center shadow-soft">
            <p className="text-sm font-black uppercase tracking-wide text-black/55">
              Pago cancelado
            </p>
            <h1 className="mt-2 text-3xl font-black text-ink">
              No se hizo ningun cargo
            </h1>
            <p className="mt-3 leading-7 text-black/70">
              Puedes volver a intentar con tarjeta o escribirnos por WhatsApp
              para ayuda con el pago.
            </p>
            <Link
              href="/"
              className="tap-target mt-6 inline-flex items-center justify-center rounded-md bg-ink px-5 py-3 font-black text-white"
            >
              Volver
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
