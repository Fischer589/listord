"use server";

import { redirect } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export async function submitHiringOutcome(formData: FormData) {
  const requestId = String(formData.get("contact_request_id") ?? "");
  const answeredBy = String(formData.get("answered_by") ?? "");
  const answer = String(formData.get("answer") ?? "");
  const note = String(formData.get("outcome_note") ?? "").trim();
  const supabase = getSupabaseClient();

  if (
    !requestId ||
    !supabase ||
    (answeredBy !== "employer" && answeredBy !== "worker") ||
    (answer !== "yes" && answer !== "no")
  ) {
    redirect("/resultados/gracias?status=pendiente");
  }

  const answeredYes = answer === "yes";
  const updates =
    answeredBy === "employer"
      ? { outcome_confirmed_by_employer: answeredYes }
      : { outcome_confirmed_by_worker: answeredYes };

  await supabase
    .from("contact_requests")
    .update({
      ...updates,
      ...(note ? { outcome_note: note } : {})
    })
    .eq("id", requestId);

  redirect("/resultados/gracias");
}
