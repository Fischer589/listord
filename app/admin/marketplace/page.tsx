import { requireAdmin } from "@/lib/admin-auth";
import { marketplaceEnabled } from "@/lib/marketplace";
import { expressEnabled } from "@/lib/express";
import { MarketplaceAdminPanel } from "@/components/marketplace-admin-panel";
import "../../solicitar/request.css";
import "./marketplace-admin.css";
export const dynamic = "force-dynamic";
export default async function MarketplaceAdminPage() {
  await requireAdmin();
  return <main className="container marketplace-admin-page"><div className="marketplace-admin-hero"><p className="moderation-eyebrow">ListoRD · Panel de administración</p><h1>Revisión de oportunidades</h1><p>Un espacio claro para revisar publicaciones, verificar cuentas y atender reportes.</p></div>{marketplaceEnabled() ? <MarketplaceAdminPanel expressAvailable={expressEnabled()} /> : <p>Deshabilitado hasta completar la aceptación de privacidad, autenticación y migraciones.</p>}</main>;
}
