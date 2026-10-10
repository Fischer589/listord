import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function EmployerAccountPage() {
  return <><AppHeader /><main className="container py-12"><h1>Mi cuenta</h1>
    <p>Explorar y contactar trabajadores es gratis.</p>
    <p>Conservamos los registros de pagos y accesos anteriores. Su revisión requiere verificar al titular; no vuelvas a pagar para recuperar un acceso.</p>
    <div className="flex flex-wrap gap-4 py-6"><Link className="btn-primary" href="/solicitar">Necesito ayuda</Link><Link className="btn-secondary" href="/oportunidades">Mis solicitudes y respuestas</Link></div>
  </main></>;
}
