import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { RequestBuilder } from "@/components/request-builder";
import { marketplaceEnabled } from "@/lib/marketplace";
import "./request.css";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Encuentra personal para tu negocio",
  description: "Cuéntanos qué necesitas, revisa perfiles compatibles gratis y elige con quién conectar por WhatsApp desde RD$100.",
};
export default function RequestPage() {
  return <><AppHeader /><main className="container request-page"><RequestBuilder publicationEnabled={marketplaceEnabled()} /></main></>;
}
