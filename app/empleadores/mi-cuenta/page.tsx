import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { EmployerWorkspace } from "@/components/employer-workspace";
import { isUuid, workspaceEnabled } from "@/lib/employer-workspace";
import { unstable_noStore as noStore } from "next/cache";

export default async function EmployerAccountPage({ searchParams }: { searchParams: Promise<{ worker?: string; checkout?: string }> }) {
  noStore();
  const query = await searchParams;
  const selectedWorkerId = isUuid(query.worker) ? query.worker : null;
  return <><AppHeader /><main className="container py-12"><h1>Mi cuenta</h1>
    <p>Explorar y contactar trabajadores es gratis.</p>
    <p>Conservamos los registros de pagos y accesos anteriores. Su revisión requiere verificar al titular; no vuelvas a pagar para recuperar un acceso.</p>
    <div className="flex flex-wrap gap-4 py-6"><Link className="btn-primary" href="/solicitar">Buscar gratis</Link></div>
    {workspaceEnabled() ? <EmployerWorkspace selectedWorkerId={selectedWorkerId} returned={query.checkout === "return"} /> :
      <p>El espacio de empleador estará disponible después de completar la verificación de pagos.</p>}
  </main></>;
}
