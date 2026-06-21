import Link from "next/link";

export const metadata = {
  title: "¡Registro exitoso! | ListoRD",
  robots: { index: false, follow: false },
};

export default function RegistroExitosoPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        fontFamily: "var(--font-body, sans-serif)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "var(--surface-pure)",
          borderRadius: "1.25rem",
          boxShadow: "0 4px 32px rgba(26,61,43,0.09)",
          padding: "2.5rem 2rem",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--green)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            fontSize: "2rem",
          }}
        >
          ✅
        </div>

        {/* Headline */}
        <h1
          style={{
            color: "var(--ink)",
            fontSize: "1.6rem",
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: "0.75rem",
          }}
        >
          ¡Tu perfil está listo!
        </h1>

        <p
          style={{
            color: "rgba(26,61,43,0.65)",
            fontSize: "1rem",
            lineHeight: 1.6,
            marginBottom: "2rem",
          }}
        >
          Tu perfil ya está visible en ListoRD. Los empleadores pueden
          encontrarte y contactarte directamente por WhatsApp.
        </p>

        {/* Steps */}
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "0.875rem",
            padding: "1.25rem 1rem",
            marginBottom: "2rem",
            textAlign: "left",
          }}
        >
          <p
            style={{
              color: "var(--ink)",
              fontWeight: 700,
              fontSize: "0.82rem",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "0.875rem",
            }}
          >
            ¿Qué sigue?
          </p>
          {[
            { emoji: "📱", text: "Cuando alguien te contacte, recibirás un mensaje de WhatsApp." },
            { emoji: "⭐", text: "Destaca tu perfil con el plan Destacado (RD$199/mes) para aparecer primero." },
            { emoji: "🔗", text: "Comparte tu perfil en tus redes sociales para más visibilidad." },
          ].map(({ emoji, text }) => (
            <div
              key={emoji}
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-start",
                marginBottom: "0.75rem",
              }}
            >
              <span style={{ fontSize: "1.1rem", marginTop: "0.05rem" }}>{emoji}</span>
              <span style={{ color: "rgba(26,61,43,0.72)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                {text}
              </span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Link
            href="/"
            style={{
              display: "block",
              padding: "0.875rem 1.5rem",
              background: "var(--green)",
              color: "#fff",
              borderRadius: "0.75rem",
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Ver mi perfil en ListoRD
          </Link>

          <Link
            href="/trabajadores/planes"
            style={{
              display: "block",
              padding: "0.875rem 1.5rem",
              background: "transparent",
              color: "var(--green)",
              border: "2px solid var(--green)",
              borderRadius: "0.75rem",
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            ⭐ Ver planes de visibilidad
          </Link>
        </div>
      </div>
    </main>
  );
}
