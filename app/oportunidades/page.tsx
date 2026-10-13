import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { MarketplaceBoard } from "@/components/marketplace-board";
import { marketplaceEnabled } from "@/lib/marketplace";
import "../solicitar/request.css";
import "./opportunities.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Oportunidades de trabajo", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function OpportunitiesPage() {
  return <><AppHeader /><main className="container opportunity-page"><p className="t-eyebrow">ListoRD · Oportunidades abiertas</p><h1>Oportunidades de trabajo</h1>{marketplaceEnabled() ? <MarketplaceBoard /> : <p>Estamos preparando las oportunidades verificadas. Todavía no se reciben respuestas.</p>}</main></>;
}
