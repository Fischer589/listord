import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { EmployerWorkspace } from "@/components/employer-workspace";
import { isUuid, workspaceEnabled } from "@/lib/employer-workspace";
import { marketplaceEnabled } from "@/lib/marketplace";
import { MarketplaceSession } from "@/components/marketplace-session";
import { EmployerOpportunities } from "@/components/employer-opportunities";
import { expressEnabled } from "@/lib/express";
import { unstable_noStore as noStore } from "next/cache";
import "./workspace.css";

export default async function EmployerAccountPage({ searchParams }: { searchParams: Promise<{ worker?: string; checkout?: string; product?: string; featured?: string; featured_opportunity?: string }> }) {
  noStore();
  const query = await searchParams;
  const selectedWorkerId = isUuid(query.worker) ? query.worker : null;
  const featuredOpportunityId = isUuid(query.featured_opportunity) ? query.featured_opportunity : null;
  return <><AppHeader /><main className="container employer-account">
    <header className="employer-account__intro">
      <div>
        <p className="workspace-eyebrow">Espacio para empleadores</p>
        <h1>Mi cuenta</h1>
        <p>Tu búsqueda sigue aquí: guarda candidatos, organiza solicitudes y vuelve a los contactos que ya desbloqueaste. Explorar perfiles es gratis.</p>
      </div>
      <Link className="btn-secondary" href="/solicitar">Encontrar mi próximo empleado</Link>
    </header>
    <p className="employer-account__legacy-note">Conservamos los registros de pagos y accesos anteriores. Su revisión requiere verificar al titular; no vuelvas a pagar para recuperar un acceso.</p>
    {workspaceEnabled() ? <EmployerWorkspace selectedWorkerId={selectedWorkerId} returned={query.checkout === "return" && query.product !== "direct"} directReturn={query.checkout === "return" && query.product === "direct"} canceled={query.checkout === "cancel"} directCanceled={query.checkout === "cancel" && query.product === "direct"} featuredReturn={query.featured === "return"} featuredCanceled={query.featured === "cancel"} featuredOpportunityId={featuredOpportunityId} opportunitiesEnabled={marketplaceEnabled()} expressAvailable={expressEnabled()} /> :
      marketplaceEnabled() ? <MarketplaceSession emailRedirectPath="/empleadores/mi-cuenta">{token => <EmployerOpportunities token={token} featuredReturn={query.featured === "return"} featuredCanceled={query.featured === "cancel"} featuredOpportunityId={featuredOpportunityId} expressAvailable={expressEnabled()} />}</MarketplaceSession> :
      <p className="workspace-panel">El espacio de empleador estará disponible después de completar la verificación de pagos.</p>}
  </main></>;
}
