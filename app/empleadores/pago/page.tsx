import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { AppHeader } from "@/components/app-header";
import { EmployerPaymentSession } from "@/components/workspace-checkout";
import { isUuid, workspaceEnabled } from "@/lib/employer-workspace";
import "../mi-cuenta/workspace.css";
import "./payment.css";

export default async function EmployerPaymentPage({ searchParams }: { searchParams: Promise<{ worker?: string }> }) {
  noStore();
  const query = await searchParams;
  const workerId = isUuid(query.worker) ? query.worker : null;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  return <><AppHeader /><main className="container employer-account payment-page">
    <div className="payment-page__top"><Link href="/empleadores/mi-cuenta">← Volver a mi cuenta</Link><span>A BLACKTHORNE BRAND</span></div>
    <header className="payment-page__header">
      <p className="workspace-eyebrow">BLACKTHORNE INDUSTRIES · ListoRD</p>
      <h1>Tu espacio, listo para organizar</h1>
      <p>Confirma el Pase de Empleador y mantén candidatos, solicitudes privadas e intentos de contacto en un solo lugar.</p>
    </header>
    <div className="payment-page__grid">
      <aside className="payment-page__summary" aria-label="Resumen del pase">
        <p className="workspace-eyebrow">Pase de Empleador</p>
        <h2>30 días de orden para contratar</h2>
        <p className="payment-page__price">RD$299</p>
        <p className="payment-page__terms">30 días · Pago único · Sin renovación automática</p>
        <ul><li>Candidatos guardados</li><li>Solicitudes privadas organizadas</li><li>Registro de intentos de contacto</li></ul>
        <p className="payment-page__free">Explorar trabajadores es gratis. El pase desbloquea el contacto durante 30 días. La disponibilidad y respuesta se confirman con cada persona.</p>
      </aside>
      <section className="payment-page__checkout" aria-label="Pago seguro">
        {workspaceEnabled() ? <EmployerPaymentSession publishableKey={publishableKey} workerId={workerId} /> :
          <p role="status">El pago del Pase de Empleador no está disponible en este momento.</p>}
      </section>
    </div>
  </main></>;
}
