import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sanitizeAnalytics } from "@/lib/analytics-policy";
import { readJsonBody } from "@/lib/http-json";
import { consumeIngestionBudget } from "@/lib/ingestion-budget";

export async function POST(request: Request) {
  try {
    const payload = sanitizeAnalytics(await readJsonBody(request, 4096));
    if (payload && await consumeIngestionBudget("analytics")) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { error } = await supabase.from("analytics_events").insert(payload);
        if (error) console.warn("Analytics event insert failed.");
      }
    }
  } catch {
    // Telemetry cannot block the user journey or echo attacker-controlled data.
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
