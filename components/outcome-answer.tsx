import Link from "next/link";
import { submitHiringOutcome } from "@/app/resultados/actions";

export function OutcomeAnswer({
  audience,
  requestId
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
        Tu respuesta ayuda a mejorar la confianza en la plataforma.
      </p>
      <form action={submitHiringOutcome} className="mt-5 grid grid-cols-2 gap-3">
        <input type="hidden" name="contact_request_id" value={requestId} />
        <input type="hidden" name="answered_by" value={audience} />
        <button
          name="answer"
          value="yes"
          className="tap-target rounded-md bg-hoja px-4 py-3 font-black text-white"
        >
          Si
        </button>
        <button
          name="answer"
          value="no"
          className="tap-target rounded-md bg-ink px-4 py-3 font-black text-white"
        >
          No
        </button>
      </form>
      <p className="mt-3 text-xs font-semibold text-black/55">
        Si las dos respuestas coinciden, ListoRD actualiza el resultado. Si no
        coinciden, queda pendiente.
      </p>
      <Link href="/" className="mt-4 inline-flex text-sm font-black text-hoja">
        Volver
      </Link>
    </section>
  );
}
