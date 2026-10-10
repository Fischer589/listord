import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { RequestBuilder } from "@/components/request-builder";
import { marketplaceEnabled } from "@/lib/marketplace";
import "./request.css";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Describe el trabajo",
  description: "Elige servicio y ciudad, define el alcance y prepara tu solicitud de trabajo sin registrarte.",
};
export default function RequestPage() {
  return <><AppHeader /><main className="container request-page"><RequestBuilder publicationEnabled={marketplaceEnabled()} /></main></>;
}
