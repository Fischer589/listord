import { requireAdmin } from "@/lib/admin-auth";
import { marketplaceEnabled } from "@/lib/marketplace";
import { MarketplaceAdminPanel } from "@/components/marketplace-admin-panel";
import "../../solicitar/request.css";
export const dynamic = "force-dynamic";
export default async function MarketplaceAdminPage() {
  await requireAdmin();
  return <main className="container request-page"><h1>Revisión de oportunidades y Express</h1>{marketplaceEnabled() ? <MarketplaceAdminPanel /> : <p>Deshabilitado hasta completar la aceptación de privacidad, autenticación y migraciones.</p>}</main>;
}
