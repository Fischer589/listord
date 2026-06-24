"use client";

import { AppHeader } from "@/components/app-header";
import { trackEvent } from "@/lib/analytics";

const WA_PHONE = "12675160983";
const WA_MESSAGE = "Hola, necesito ayuda encontrando personal para mi negocio.";
const WA_URL = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(WA_MESSAGE)}`;

function WhatsAppButton({ size = "default" }: { size?: "default" | "large" }) {
  function handleClick() {
    try {
      trackEvent("contact_click", { page: "soluciones-empresariales", source: "business" });
    } catch {
      // analytics failure never blocks navigation
    }
  }

  const cls =
    size === "large"
      ? "inline-flex items-center gap-2.5 btn-primary text-white text-base sm:text-lg font-bold px-8 py-4 rounded-[var(--r-lg)]"
      : "inline-flex items-center gap-2 btn-primary text-white text-sm font-bold px-6 py-3 rounded-[var(--r-lg)]";

  return (
    <a
      href={WA_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={cls}
    >
      📲 CONTACTAR POR WHATSAPP
    </a>
  );
}

const POSITIONS = [
  "Limpieza",
  "Cocina",
  "Servicio al Cliente",
  "Ventas",
  "Construcción",
  "Mantenimiento",
  "Choferes",
  "Hoteles y Turismo",
  "Barbería y Belleza",
  "Otras Posiciones",
];

const IDEAL_FOR = [
  "Empresas que necesitan contratar rápidamente",
  "Hoteles y alojamientos",
  "Restaurantes",
  "Empresas de limpieza",
  "Constructoras",
  "Negocios locales",
  "Proyectos temporales",
  "Contrataciones múltiples",
];

const HOW_IT_WORKS = [
  { n: "1", text: "Cuéntanos qué tipo de personal necesitas." },
  { n: "2", text: "Revisaremos nuestra red de trabajadores disponibles." },
  { n: "3", text: "Te ayudaremos a identificar candidatos relevantes." },
  { n: "4", text: "Coordinaremos los próximos pasos contigo." },
];

export default function SolucionesEmpresarialesPage() {
  return (
    <div className="page-shell">
      <AppHeader />

      <main>

        {/* ── Hero ── */}
        <section className="section--sm border-b border-[var(--border)]">
          <div className="container max-w-3xl">
            <span className="t-eyebrow block mb-4">Soluciones Empresariales</span>
            <h1 className="t-headline mb-5">¿Necesitas personal?</h1>
            <p className="t-body mb-3" style={{ fontSize: "1.1rem" }}>
              ListoRD ayuda a empresas, hoteles, restaurantes y negocios a encontrar
              trabajadores disponibles dentro de nuestra red.
            </p>
            <p className="t-body mb-8">
              Ya sea una contratación individual o múltiples trabajadores, podemos
              ayudarte a identificar candidatos para distintas posiciones.
            </p>
            <WhatsAppButton size="large" />
          </div>
        </section>

        {/* ── No siempre necesitas buscar ── */}
        <section className="section--sm" style={{ background: "var(--surface)" }}>
          <div className="container max-w-3xl">
            <h2 className="t-title mb-3">No siempre necesitas buscar.</h2>
            <p className="t-body mb-2">A veces simplemente necesitas contratar.</p>
            <p className="t-body mb-6">
              Si estás buscando personal para tu empresa, hotel, restaurante, proyecto
              o negocio, ListoRD puede ayudarte a identificar candidatos dentro de
              nuestra red.
            </p>
            <p className="text-sm font-semibold" style={{ color: "var(--green)" }}>
              📲 Habla directamente con ListoRD.
            </p>
          </div>
        </section>

        {/* ── Positions ── */}
        <section className="section--sm">
          <div className="container max-w-3xl">
            <span className="t-eyebrow block mb-4">Área de trabajo</span>
            <h2 className="t-title mb-6">Podemos ayudarte con:</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {POSITIONS.map((pos) => (
                <li
                  key={pos}
                  className="flex items-center gap-3 rounded-[var(--r)] border border-[var(--border)] px-4 py-3 text-sm font-medium"
                  style={{ background: "var(--surface)", color: "var(--ink)" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: "var(--green)" }}
                  />
                  {pos}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Ideal for ── */}
        <section
          className="section--sm border-y border-[var(--border)]"
          style={{ background: "var(--surface)" }}
        >
          <div className="container max-w-3xl">
            <span className="t-eyebrow block mb-4">Ideal para</span>
            <h2 className="t-title mb-6">Esta página es ideal para:</h2>
            <ul className="space-y-3">
              {IDEAL_FOR.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: "var(--green)" }}
                  />
                  <span className="t-body">{item}</span>
                </li>
              ))}
            </ul>
            <p
              className="t-body mt-6 text-sm"
              style={{ color: "var(--muted)" }}
            >
              Si necesitas personal y no sabes por dónde empezar, contáctanos.
            </p>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="section--sm">
          <div className="container max-w-3xl">
            <span className="t-eyebrow block mb-4">El proceso</span>
            <h2 className="t-title mb-8">¿Cómo Funciona?</h2>
            <ol className="space-y-5">
              {HOW_IT_WORKS.map(({ n, text }) => (
                <li key={n} className="flex items-start gap-4">
                  <span
                    className="flex-shrink-0 w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center text-sm font-bold"
                    style={{ background: "var(--green-bg)", color: "var(--green)" }}
                  >
                    {n}
                  </span>
                  <p className="t-body pt-1.5">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Multiple hiring ── */}
        <section
          className="section--sm"
          style={{ background: "var(--surface)" }}
        >
          <div className="container max-w-3xl">
            <span className="t-eyebrow block mb-3">Reclutamiento a escala</span>
            <h2 className="t-title mb-5">Contrataciones Múltiples</h2>
            <ul className="space-y-2.5 mb-6">
              {[
                "¿Necesitas varias personas?",
                "¿Necesitas apoyo para reclutamiento?",
                "¿Necesitas contratar un equipo completo?",
              ].map((q) => (
                <li key={q} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: "var(--green)" }}
                  />
                  <span className="t-body">{q}</span>
                </li>
              ))}
            </ul>
            <p className="t-body">
              Podemos ayudarte a identificar candidatos dentro de nuestra red.
            </p>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="section border-t border-[var(--border)]">
          <div className="container max-w-3xl text-center">
            <span className="t-eyebrow block mb-4">Contacto directo</span>
            <h2 className="t-headline mb-5">
              Habla Directamente<br className="hidden sm:block" /> con ListoRD
            </h2>
            <p className="t-body mb-2">¿Necesitas personal?</p>
            <p className="t-body mb-2">¿Tienes preguntas sobre contratación?</p>
            <p className="t-body mb-8">¿Buscas uno o varios trabajadores?</p>

            <div
              className="inline-block rounded-[var(--r-xl)] px-8 py-6 mb-8"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-mid)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <p
                className="text-[10px] font-extrabold tracking-[0.12em] uppercase mb-1.5"
                style={{ color: "var(--muted)" }}
              >
                WhatsApp
              </p>
              <p
                className="text-3xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
              >
                267-516-0983
              </p>
            </div>

            <div className="flex justify-center">
              <WhatsAppButton size="large" />
            </div>

            <p className="mt-5 text-xs" style={{ color: "var(--muted)" }}>
              Mensaje sugerido: &ldquo;Hola, necesito ayuda encontrando personal para mi negocio.&rdquo;
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
