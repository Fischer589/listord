import Link from "next/link";

export function OutcomeAnswer({
  audience,
  requestId: _requestId
}: {
  audience: "employer" | "worker";
  requestId: string;
}) {
  const question =
    audience === "employer"
      ? "¿Contrataste a esta persona?"
      : "¿Te contrataron?";

  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-soft">
      <p className="text-sm font-black uppercase tracking-wide text-hoja">
        Resultado de contratacion
      </p>
      <h1 className="mt-2 text-3xl font-black">{question}</h1>
      <p className="mt-3 leading-7 text-black/70">
        La confirmación de resultados está temporalmente suspendida mientras
        verificamos el acceso de cada participante. No se ha registrado ninguna respuesta.
      </p>
      <Link href="/" className="mt-4 inline-flex text-sm font-black text-hoja">
        Volver
      </Link>
    </section>
  );
}
