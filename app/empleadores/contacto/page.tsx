import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { AppHeader } from "@/components/app-header";
import { DirectContactSession } from "@/components/direct-contact-checkout";
import { isUuid } from "@/lib/employer-workspace";
import "../mi-cuenta/workspace.css";
import "../pago/payment.css";

export default async function DirectContactPage({ searchParams }: { searchParams: Promise<{ worker?: string }> }) {
  noStore();
  const query = await searchParams;
  const workerId = isUuid(query.worker) ? query.worker : null;
  return <><AppHeader /><main className="container employer-account payment-page">
    <div className="payment-page__top"><Link href={workerId ? `/trabajador/${encodeURIComponent(workerId)}` : "/"}>← Seguir explorando</Link></div>
    <header className="payment-page__header">
      <p className="workspace-eyebrow">Contacto directo · ListoRD</p>
      <h1>¿Ya encontraste a quien necesitas?</h1>
      <p>Desbloquea el contacto de la persona que elegiste y habla directamente con ella.</p>
    </header>
    <div className="payment-page__grid">
      <aside className="payment-page__summary" aria-label="Resumen del contacto directo">
        <p className="workspace-eyebrow">Un trabajador</p>
        <h2>Contacto directo</h2>
        <p className="payment-page__price">RD$89</p>
        <p className="payment-page__terms">Un pago. Un contacto. Sin renovación automática.</p>
        <p className="payment-page__free">El pago desbloquea únicamente el contacto del trabajador seleccionado, tras la confirmación de Stripe. Confirma disponibilidad y condiciones directamente.</p>
      </aside>
      <section className="payment-page__checkout" aria-label="Pago seguro">
        {process.env.NEXT_PUBLIC_DIRECT_CONTACT_ENABLED === "true" ? <DirectContactSession workerId={workerId} /> :
          <p role="status">El contacto directo no está disponible en este momento.</p>}
      </section>
    </div>
  </main></>;
}
