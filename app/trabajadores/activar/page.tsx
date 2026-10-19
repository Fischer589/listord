import { AppHeader } from "@/components/app-header";
import { WorkerActivation } from "@/components/worker-activation";
import "@/app/solicitar/request.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirma tu perfil y disponibilidad", robots: { index: false, follow: false } };

export default function WorkerActivationPage() {
  return <><AppHeader /><main className="container request-page"><WorkerActivation /></main></>;
}
