import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://listord.com"),
  title: {
    default: "ListoRD – Trabajadores listos hoy",
    template: "%s | ListoRD"
  },
  description:
    "Encuentra trabajadores verificados y disponibles hoy en República Dominicana. Filtra por ciudad, habilidad, ingreso y disponibilidad.",
  applicationName: "ListoRD",
  keywords: [
    "trabajadores República Dominicana",
    "empleos RD",
    "contratar trabajadores",
    "Santo Domingo",
    "Santiago",
    "ListoRD"
  ],
  openGraph: {
    title: "ListoRD | Trabajadores listos para trabajar hoy",
    description:
      "Personas reales, disponibles ahora mismo en tu ciudad.",
    url: "https://listord.com",
    siteName: "ListoRD",
    locale: "es_DO",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "ListoRD",
    description:
      "Trabajadores listos para trabajar hoy en República Dominicana."
  },
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>
        {children}
        <footer className="border-t border-hoja/15 bg-card py-7 text-center text-sm font-bold text-ink/60">
          <p>© 2026 ListoRD</p>
          <nav className="mt-3 flex flex-wrap items-center justify-center gap-4 text-ink">
            <Link href="/trabajadores/editar">Editar mi perfil</Link>
            <Link href="/trabajadores/registro">Registrarme como trabajador</Link>
          </nav>
          <p className="mt-3 text-ink">Encuentra. Conecta. Listo.</p>
        </footer>
      </body>
    </html>
  );
}
