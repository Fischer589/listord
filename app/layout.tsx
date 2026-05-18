import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://listordapp.com"),
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
    url: "https://listordapp.com",
    siteName: "ListoRD",
    images: [
      {
        url: "/logo.png",
        width: 1536,
        height: 1024,
        alt: "ListoRD"
      }
    ],
    locale: "es_DO",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "ListoRD",
    description:
      "Trabajadores listos para trabajar hoy en República Dominicana.",
    images: [
      {
        url: "/logo.png",
        alt: "ListoRD"
      }
    ]
  },
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: [
      {
        url: "/logo.png",
        sizes: "1536x1024",
        type: "image/png"
      }
    ],
    shortcut: [
      {
        url: "/logo.png",
        sizes: "1536x1024",
        type: "image/png"
      }
    ],
    apple: [
      {
        url: "/logo.png",
        sizes: "1536x1024",
        type: "image/png"
      }
    ]
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
        <footer className="border-t border-hoja/15 bg-card py-8 text-center text-sm font-bold text-ink/55">
          <p className="text-base font-black text-ink">
            Encuentra. Conecta. Listo. 🇩🇴
          </p>
          <p className="mt-1 text-ink/55">© 2026 ListoRD</p>
          <nav className="mt-4 flex flex-wrap items-center justify-center gap-4 text-ink/70">
            <Link href="/" className="hover:text-ink">Inicio</Link>
            <Link href="/empleadores" className="hover:text-ink">Para empleadores</Link>
            <Link href="/trabajadores/registro" className="hover:text-ink">Busco trabajo</Link>
            <Link href="/trabajadores/editar" className="hover:text-ink">Editar mi perfil</Link>
          </nav>
          <p className="mt-4 text-xs text-ink/40">
            Trabajadores verificados en República Dominicana · Contacto directo por WhatsApp
          </p>
        </footer>
      </body>
    </html>
  );
}
