import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ContactCreditsSession } from "@/components/contact-credits-checkout";
import { isUuid } from "@/lib/employer-workspace";
import "../mi-cuenta/workspace.css";
import "../pago/payment.css";

export const dynamic = "force-dynamic";

export default async function ContactCreditsPage({ searchParams }: { searchParams: Promise<{ worker?: string; checkout?: string }> }) {
  const query = await searchParams;
  const workerId = isUuid(query.worker) ? query.worker : null;
  return <><AppHeader /><main className="container employer-account payment-page">
    <div className="payment-page__top"><Link href={workerId ? `/trabajador/${encodeURIComponent(workerId)}` : "/"}>← Seguir explorando</Link></div>
    <header className="payment-page__header">
      <p className="workspace-eyebrow">Contactos prepagados · ListoRD</p>
      <h1>Compra contactos cuando los necesites</h1>
      <p>Explora gratis. Cada trabajador nuevo que desbloquees usa un crédito; vuelve a contactar a los ya desbloqueados sin pagar otra vez.</p>
    </header>
    <ContactCreditsSession workerId={workerId} returned={query.checkout === "return"} />
  </main></>;
}
