import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function ContactRequestPage({
  params
}: {
  params: { workerId: string };
}) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/" className="text-sm font-bold text-hoja">
          Volver a trabajadores
        </Link>
        <section className="mt-4 rounded-lg border border-black/10 bg-white p-5 shadow-soft">
          <p className="text-sm font-black uppercase tracking-wide text-hoja">
            Solicitud de contacto
          </p>
          <h1 className="mt-2 text-3xl font-black">Contactar trabajador</h1>
          <p className="mt-3 leading-7 text-black/70">
            En el plan gratis, la solicitud queda pendiente para proteger la
            confianza. Los empleadores pagos pueden abrir WhatsApp al instante.
          </p>
          <form className="mt-5 grid gap-3">
            <input type="hidden" name="worker_id" value={params.workerId} />
            <label className="grid gap-1 font-bold">
              Tu nombre
              <input className="tap-target rounded-md border border-black/15 px-3" name="contact_name" />
            </label>
            <label className="grid gap-1 font-bold">
              Empresa o negocio
              <input className="tap-target rounded-md border border-black/15 px-3" name="company_name" />
            </label>
            <label className="grid gap-1 font-bold">
              WhatsApp
              <input className="tap-target rounded-md border border-black/15 px-3" name="whatsapp_number" />
            </label>
            <button className="tap-target rounded-md bg-hoja px-4 py-3 font-black text-white">
              Enviar solicitud gratis
            </button>
          </form>
          <div className="mt-4 rounded-md bg-mango/20 p-3">
            <p className="font-black">Consigue trabajadores mas rapido</p>
            <p className="mt-1 text-sm leading-6 text-black/70">
              RD$99 por semana o RD$199 por mes desbloquea contacto instantaneo
              y prioridad.
            </p>
            <Link href="/empleadores" className="mt-2 inline-flex font-black text-ink">
              Ver acceso pago
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
