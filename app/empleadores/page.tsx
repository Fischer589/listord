import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function EmployersPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        {/* ── HERO ── */}
        {/* Account status shortcut */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
          <a
            href="/empleadores/mi-cuenta"
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--green)",
              textDecoration: "none",
              padding: "0.35rem 0.75rem",
              border: "1px solid rgba(45,122,79,0.25)",
              borderRadius: "999px",
              background: "var(--surface)",
            }}
          >
            Mi cuenta →
          </a>
        </div>

        <section className="grid gap-8 md:grid-cols-[1fr_0.85fr] md:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-hoja">
              Para empleadores
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-ink">
              Consigue trabajadores más rápido
            </h1>
            <p className="mt-4 max-w-xl leading-7 text-ink/70">
              Describe el servicio que necesitas, revisa perfiles compatibles y
              contacta gratis por WhatsApp. Confirma directamente la disponibilidad
              y los requisitos con cada persona.
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
                text="Contacta directo por WhatsApp — gratis"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-hoja/20 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-black text-ink">Describe lo que necesitas</h2>
            <p className="mt-3 leading-7 text-ink/70">Elige servicio y ciudad, concreta las condiciones y revisa las coincidencias reales. Un perfil compatible no es una respuesta de interés.</p>
            <Link href="/solicitar" className="tap-target mt-5 flex items-center justify-center rounded-xl bg-hoja px-4 py-4 font-black text-white">Preparar mi solicitud</Link>
          </div>
        </section>

        {/* ── TRUST CARDS ── */}
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <TrustCard
            icon="🚫"
            title="No bloqueamos el empleo"
            text="Puedes descubrir perfiles y abrir el contacto sin pagar."
          />
          <TrustCard
            icon="🎁"
            title="Contacto gratuito"
            text="Habla directamente y acuerda las condiciones con cada trabajador."
          />
          <TrustCard
            icon="✅"
            title="Perfiles verificados"
            text="La aprobación del perfil no confirma disponibilidad, cualificaciones ni interés en tu solicitud."
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
