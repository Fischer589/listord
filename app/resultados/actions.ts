"use server";

import { redirect } from "next/navigation";
export async function submitHiringOutcome(_formData: FormData) {
  // A request ID and a caller-selected audience prove no ownership. Keep old
  // action references safe until verified participant authentication is accepted.
  // Do not bypass the legacy invoker trigger's permissions with a service key.
  redirect("/resultados/gracias?status=pendiente");
}
