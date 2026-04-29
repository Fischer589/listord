import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { normalizeWhatsAppNumber } from "@/lib/worker-profile";

export default function RecoverWorkerEditLinkPage({
  searchParams
}: {
  searchParams: { whatsapp?: string };
}) {
  const whatsappNumber = searchParams.whatsapp?.trim() || "";
  const normalizedWhatsAppNumber = normalizeWhatsAppNumber(whatsappNumber);
  const hasSearch = Boolean(whatsappNumber);
  const adminPhone =
    process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_PHONE?.replace(/\D/g, "") ||
    "18090000000";
  const supportMessage = encodeURIComponent(
    `Hola, necesito recuperar mi enlace de edición de ListoRD. Mi WhatsApp es ${whatsappNumber}.`
  );

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/trabajadores/editar" className="text-sm font-bold text-hoja">
          Volver
        </Link>
        <h1 className="mt-3 text-3xl font-black">Recuperar enlace</h1>
        <p className="mt-2 leading-7 text-black/70">
          Por seguridad no mostramos enlaces de edicion solo con un numero de
          WhatsApp. Te ayudamos a recuperarlo por soporte.
        </p>

        <form className="mt-5 grid gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-soft">
          <label className="grid gap-1 font-bold">
            Numero de WhatsApp
            <input
              className="tap-target rounded-md border border-black/15 px-3"
              name="whatsapp"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={whatsappNumber}
              placeholder="8091234567 o +12675160983"
              required
            />
          </label>
          <button className="tap-target rounded-md bg-ink px-4 py-3 font-black text-white">
            Preparar solicitud
          </button>
        </form>

        {hasSearch && !normalizedWhatsAppNumber && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-900">
            Usa un numero de WhatsApp valido con al menos 10 digitos.
          </div>
        )}

        {normalizedWhatsAppNumber && (
          <div className="mt-5 rounded-lg border border-hoja/30 bg-hoja/10 p-4 text-ink">
            <p className="font-bold">Solicitud lista</p>
            <p className="mt-1 text-sm font-semibold text-black/65">
              Te pediremos confirmar que este perfil es tuyo antes de enviar el
              enlace.
            </p>
            <a
              href={`https://wa.me/${adminPhone}?text=${supportMessage}`}
              className="mt-3 inline-flex tap-target items-center rounded-md bg-hoja px-4 py-3 font-black text-white"
            >
              Escribir por WhatsApp
            </a>
          </div>
        )}
      </main>
    </>
  );
}
