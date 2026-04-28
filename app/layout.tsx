import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://listord.com"),
  title: {
    default: "ListoRD | Trabajadores listos en RD",
    template: "%s | ListoRD"
  },
  description:
    "Conecta con gente seria, disponible y cerca de ti en República Dominicana.",
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
      </body>
    </html>
  );
}
