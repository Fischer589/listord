import { createHmac } from "node:crypto";
import { marketplaceEnabled } from "./marketplace";
import { getSupabaseAdminClient } from "./supabase-admin";

/** Distributed write budgets for the 2.0 gate. Never trust caller IP headers.
 * HMACs hide submitted phones; the global cap bounds rotating identities too. */
export async function consumeIngestionBudget(action: "registration" | "analytics", subject = "global") {
  if (!marketplaceEnabled()) return true;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = getSupabaseAdminClient();
  if (!secret || !admin) return false;
  const digest = createHmac("sha256", secret).update(`listord-budget:${action}:${subject}`).digest("hex");
  try {
    const { data, error } = await admin.rpc("marketplace_ingestion_budget", { p_action: action, p_subject: digest }).abortSignal(AbortSignal.timeout(8000));
    return !error && data === true;
  } catch { return false; }
}
