import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { LISTORD_BUSINESS_WHATSAPP } from "@/lib/business-contact";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reclamar perfil de trabajador", robots: { index: false, follow: false } };

export default async function ClaimWorkerPage({ searchParams }: {
  searchParams: Promise<{ perfil?: string }>;
}) {
  const requested = (await searchParams).perfil ?? "";
  const workerId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requested)
    ? requested : null;
  const supportPhone = LISTORD_BUSINESS_WHATSAPP;
  const message = workerId
    ? `Hola, quiero solicitar la revisión de titularidad de mi perfil de ListoRD: ${workerId}. Indíquenme cómo verificar mi cuenta y aportar prueba independiente por un canal privado.`
    : "Hola, quiero solicitar la revisión de titularidad de mi perfil de ListoRD. Indíquenme cómo identificar el perfil, verificar mi cuenta y aportar prueba independiente por un canal privado.";
  return <><AppHeader /><main className="container request-page">
    <section className="request-builder">
      <h1>Solicita la titularidad de tu perfil</h1>
      <p>Inicia sesión y verifica tu correo en ListoRD antes de solicitar la revisión. Un número de WhatsApp, un enlace antiguo o los datos visibles del perfil no demuestran que sea tuyo.</p>
      <p>Soporte abrirá un caso privado, te pedirá una prueba independiente que vincule tu identidad con este perfil y confirmará que deseas controlarlo. Si el número es compartido o hay datos contradictorios, una segunda persona revisará el caso. La revisión no confirma disponibilidad ni activa avisos de trabajo.</p>
      <p>No envíes documentos de identidad en un chat abierto. Soporte te indicará un canal privado aprobado para aportar evidencia.</p>
      {supportPhone ? <a className="btn-primary" href={`https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`}>Iniciar solicitud por WhatsApp</a>
        : <p role="status">El canal de soporte para solicitudes de titularidad aún no está configurado. Conserva este enlace y vuelve más tarde.</p>}
      <Link className="btn-secondary" href={workerId ? `/trabajadores/activar?perfil=${encodeURIComponent(workerId)}` : "/trabajadores/activar"}>Volver a mi perfil</Link>
    </section>
  </main></>;
}
