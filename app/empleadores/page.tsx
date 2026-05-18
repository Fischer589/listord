import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function EmployersPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        {/* ── HERO ── */}
        <section className="grid gap-8 md:grid-cols-[1fr_0.85fr] md:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-hoja">
              Para empleadores
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-ink">
              Consigue trabajadores más rápido
            </h1>
            <p className="mt-4 max-w-xl leading-7 text-ink/70">
              Navega gratis y usa 1 contacto diario sin pagar. El acceso
              premium desbloquea WhatsApp instantáneo, perfiles en prioridad y
              señales de confianza — sin bloquear el empleo.
            </p>

            {/* How it works */}
            <div className="mt-8 grid gap-3">
              <p className="text-sm font-black uppercase tracking-wide text-hoja">
                Así funciona
              </p>
              <HowStep number={1} text="Busca por ciudad y tipo de trabajo" />
              <HowStep number={2} text="Revisa perfiles verificados reales" />
              <HowStep
                number={3}
                text="Contacta directo por WhatsApp — gratis el primero"
              />
            </div>
          </div>

          {/* Pricing card */}
          <div className="rounded-2xl border border-hoja/20 bg-white p-5 shadow-soft">
            <p className="text-sm font-black uppercase tracking-wide text-hoja">
              Acceso premium
            </p>
            <p className="mt-2 text-lg font-black text-ink">
              Desde RD$99 puedes contactar trabajadores listos para trabajar hoy.
            </p>
            <div className="mt-4 grid gap-3">
              <PlanCard
                title="Mensual"
                price="RD$199 / mes"
                detail="El mejor valor — contratación constante sin límites"
                recommended
              />
              <PlanCard
                title="Semanal"
                price="RD$99 / semana"
                detail="Acceso rápido por 7 días"
              />
            </div>
            <Link
              href="/"
              className="tap-target mt-5 flex items-center justify-center rounded-xl bg-gradient-to-br from-ink to-[#2d4a1e] px-4 py-4 font-black text-white shadow-[0_16px_40px_rgba(29,29,27,0.22)]"
            >
              Buscar trabajadores ahora
            </Link>
            <p className="mt-3 text-center text-xs font-semibold text-ink/50">
              Sin compromiso · Cancela cuando quieras
            </p>
          </div>
        </section>

        {/* ── TRUST CARDS ── */}
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <TrustCard
            icon="🚫"
            title="No bloqueamos el empleo"
            text="El pago compra velocidad y prioridad, no permiso para trabajar. Los trabajadores son siempre libres."
          />
          <TrustCard
            icon="🎁"
            title="Gratis para empezar"
            text="1 contacto gratis al día te permite validar el servicio antes de pagar."
          />
          <TrustCard
            icon="✅"
            title="Perfiles verificados"
            text="Cada perfil es revisado manualmente. Tú hablas con personas reales."
          />
        </section>

        {/* ── WORKER CTA ── */}
        <section className="mt-10 rounded-2xl border border-hoja/20 bg-cielo/60 p-6 text-center">
          <p className="text-sm font-black uppercase tracking-wide text-hoja">
            ¿Eres trabajador?
          </p>
          <h2 className="mt-2 text-2xl font-black text-ink">
            Crea tu perfil gratis y hazte visible
          </h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-ink/70">
            Los clientes te encontrarán por ciudad y servicio, y te contactarán
            directo por WhatsApp.
          </p>
          <Link
            href="/trabajadores/registro"
            className="tap-target mt-5 inline-flex items-center justify-center rounded-xl border border-hoja/30 bg-white px-6 py-3 font-black text-ink shadow-soft hover:bg-cielo"
          >
            Crear mi perfil gratis →
          </Link>
        </section>
      </main>
    </>
  );
}

function HowStep({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-[rgba(31,31,28,0.07)] bg-white p-3 shadow-[0_4px_12px_rgba(29,29,27,0.05)]">
      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-hoja/15 text-sm font-black text-hoja">
        {number}
      </span>
      <p className="font-black text-ink/80">{text}</p>
    </div>
  );
}

function PlanCard({
  title,
  price,
  detail,
  recommended
}: {
  title: string;
  price: string;
  detail: string;
  recommended?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4${recommended ? " border-hoja/40 bg-cielo/60" : " border-black/10"}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="font-black text-ink">{title}</h2>
          {recommended && (
            <span className="rounded-full bg-hoja px-2 py-0.5 text-xs font-black text-white">
              Más popular
            </span>
          )}
        </div>
        <p className="shrink-0 text-xl font-black text-hoja">{price}</p>
      </div>
      <p className="mt-1 text-sm text-ink/60">{detail}</p>
    </div>
  );
}

function TrustCard({
  icon,
  title,
  text
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-[rgba(31,31,28,0.07)] bg-white p-5 shadow-soft">
      <span className="text-2xl">{icon}</span>
      <h2 className="mt-2 font-black text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/65">{text}</p>
    </div>
  );
}
