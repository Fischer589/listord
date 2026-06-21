import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suscripción activada | ListoRD",
  description: "Tu plan de trabajador ha sido activado en ListoRD.",
};

export default function WorkerSubscriptionSuccess({
  searchParams,
}: {
  searchParams: { plan?: string };
}) {
  const plan = searchParams?.plan;
  const isFeatured = plan === "featured";
  const isPro      = plan === "pro";

  return (
    <main className="page-shell" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        className="container"
        style={{ maxWidth: "520px", textAlign: "center", padding: "3rem 1.5rem" }}
      >
        <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>
          {isFeatured ? "⭐" : isPro ? "🏆" : "✅"}
        </p>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
            fontWeight: 400,
            color: "var(--ink)",
            marginBottom: "0.75rem",
          }}
        >
          {isFeatured
            ? "¡Eres Trabajador Destacado!"
            : isPro
            ? "¡Activaste tu Perfil Pro!"
            : "¡Suscripción activada!"}
        </h1>

        <p style={{ color: "rgba(26,61,43,0.65)", fontSize: "1.05rem", marginBottom: "2rem", lineHeight: 1.6 }}>
          {isFeatured
            ? "Tu perfil aparecerá primero en los resultados de búsqueda. Los empleadores te encontrarán antes."
            : isPro
            ? "Tu Perfil Pro ya está activo. Próximamente se habilitarán las funciones adicionales."
            : "Tu plan ha sido activado exitosamente."}
        </p>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/" className="btn-primary tap-target">
            Ver mi perfil en ListoRD
          </Link>
        </div>

        <p style={{ marginTop: "2rem", fontSize: "0.8rem", color: "rgba(26,61,43,0.45)" }}>
          Recibirás un correo de confirmación de Stripe.
          Si tienes dudas, escríbenos por WhatsApp.
        </p>
      </div>
    </main>
  );
}
