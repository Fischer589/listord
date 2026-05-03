import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function EmployersPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="grid gap-6 md:grid-cols-[1fr_0.8fr] md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-hoja">
              Para empleadores
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight">
              Consigue trabajadores mas rapido
            </h1>
            <p className="mt-3 max-w-xl leading-7 text-black/70">
              Puedes navegar gratis y usar 1 contacto diario sin pagar. El acceso de
              pago desbloquea WhatsApp instantaneo, prioridad y senales de
              confianza sin bloquear empleo.
            </p>
            <div className="mt-4 inline-flex rounded-md bg-cielo px-3 py-2 text-sm font-black text-ink">
              Ha contratado 0 trabajadores
            </div>
          </div>
          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
            <p className="text-lg font-black">
              Por menos de RD$100 puedes contactar trabajadores listos para
              trabajar hoy.
            </p>
            <div className="mt-4 grid gap-3">
              <PlanCard title="Semanal" price="RD$99" detail="Acceso rapido por 7 dias" />
              <PlanCard title="Mensual" price="RD$199" detail="Mejor para contratacion constante" />
            </div>
            <Link
              href="/"
              className="tap-target mt-4 flex items-center justify-center rounded-md bg-ink px-4 py-3 font-black text-white"
            >
              Buscar trabajadores
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <TrustCard title="No bloqueamos empleo" text="El pago compra velocidad y prioridad, no permiso para trabajar." />
          <TrustCard title="Gratis para empezar" text="1 contacto gratis al día ayuda a validar la necesidad antes de pagar." />
          <TrustCard title="Confianza visible" text="La reputacion se basa en presentarse, pagar y responder." />
        </section>
      </main>
    </>
  );
}

function PlanCard({
  title,
  price,
  detail
}: {
  title: string;
  price: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-black/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-black">{title}</h2>
        <p className="text-2xl font-black text-hoja">{price}</p>
      </div>
      <p className="text-sm text-black/65">{detail}</p>
    </div>
  );
}

function TrustCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg bg-cielo p-4">
      <h2 className="font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-black/70">{text}</p>
    </div>
  );
}
