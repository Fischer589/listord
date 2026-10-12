import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { EmployerWorkspace } from "@/components/employer-workspace";
import { isUuid, workspaceEnabled } from "@/lib/employer-workspace";
import { unstable_noStore as noStore } from "next/cache";
import "./workspace.css";

export default async function EmployerAccountPage({ searchParams }: { searchParams: Promise<{ worker?: string; checkout?: string }> }) {
  noStore();
  const query = await searchParams;
  const selectedWorkerId = isUuid(query.worker) ? query.worker : null;
  return <><AppHeader /><main className="container employer-account">
    <header className="employer-account__intro">
      <div>
        <p className="workspace-eyebrow">Espacio para empleadores</p>
        <h1>Mi cuenta</h1>
        <p>Organiza tus candidatos y solicitudes en un solo lugar. Explorar perfiles y contactar por WhatsApp sigue siendo gratis.</p>
      </div>
      <Link className="btn-secondary" href="/solicitar">Buscar trabajadores gratis</Link>
    </header>
    <p className="employer-account__legacy-note">Conservamos los registros de pagos y accesos anteriores. Su revisión requiere verificar al titular; no vuelvas a pagar para recuperar un acceso.</p>
    {workspaceEnabled() ? <EmployerWorkspace selectedWorkerId={selectedWorkerId} returned={query.checkout === "return"} canceled={query.checkout === "cancel"} /> :
      <p className="workspace-panel">El espacio de empleador estará disponible después de completar la verificación de pagos.</p>}
  </main></>;
}
