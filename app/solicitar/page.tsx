import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { RequestBuilder } from "@/components/request-builder";
import { marketplaceEnabled } from "@/lib/marketplace";
import "./request.css";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "¡Encontramos a tu próximo trabajador!",
  description: "El personal que necesitas. Sin tantas vueltas. Explora trabajadores y conecta directamente por solo RD$100, o publica tu vacante.",
};
export default function RequestPage() {
  return <><AppHeader /><main className="container request-page">
    <section className="request-hero" aria-labelledby="request-hero-title">
      <div className="request-hero-content">
        <p className="request-hero-eyebrow">🇩🇴 HECHO PARA NEGOCIOS EN REPÚBLICA DOMINICANA</p>
        <h1 id="request-hero-title">¡Encontramos a tu próximo trabajador!</h1>
        <p className="request-hero-subtitle">El personal que necesitas. Sin tantas vueltas.</p>
        <div className="request-hero-copy">
          <p>Explora trabajadores, encuentra el perfil adecuado para tu negocio y conecta directamente por solo <strong>RD$100</strong>.</p>
          <p>¿Prefieres esperar? Publica tu vacante y recibe oportunidades de conexión.</p>
          <p>Tú eliges cómo contratar. ListoRD hace la búsqueda más fácil.</p>
        </div>
        <div className="request-hero-actions">
          <Link className="btn-primary" href="/#descubre">Encuentra tu próximo trabajador</Link>
          <Link className="btn-secondary" href="#publicar-vacante">Publicar y esperar</Link>
        </div>
      </div>
    </section>
    <div id="publicar-vacante"><RequestBuilder publicationEnabled={marketplaceEnabled()} /></div>
  </main></>;
}
