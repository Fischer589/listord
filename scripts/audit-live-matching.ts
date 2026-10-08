// Read-only diagnostic. Config path must contain {url,key}; use anon key only.
// Outputs aggregate results, never worker identities, keys or raw DB errors.
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { findMatches, MATCH_COLUMNS, MATCH_LIMIT, MATCH_WINDOW_DAYS } from "../lib/request-matching";
import { emptyRequest } from "../lib/request-specification";
async function main() {
  const config = JSON.parse(await readFile(process.argv[2], "utf8"));
  const now = new Date();
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const page = await client.from("workers").select(MATCH_COLUMNS, { count: "exact" })
    .eq("is_verified", true).eq("available_now", true)
    .gte("created_at", new Date(now.getTime() - MATCH_WINDOW_DAYS * 86400000).toISOString())
    .lte("created_at", now.toISOString()).order("id").range(0, MATCH_LIMIT - 1).abortSignal(AbortSignal.timeout(15000));
  const report: Record<string, unknown> = { checkedAt: now.toISOString(), status: page.status, candidateCount: page.count, returnedRows: page.data?.length ?? null, queryCompatible: !page.error };
  if (!page.error) {
    const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", timing: "Fecha flexible", duration: "Por acordar", compensation: "negotiable" as const, answers: { property: "Casa", tasks: "Limpieza", supplies: "Por acordar" } };
    const result = await findMatches(draft, async () => page, now);
    report.sampleMatch = { category: draft.category, city: draft.city, count: result.count };
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(() => { console.error("Read-only audit failed; no credentials or database details printed."); process.exitCode = 1; });
