import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sanitizeAnalytics } from "@/lib/analytics-policy";
import { readJsonBody } from "@/lib/http-json";
import { consumeIngestionBudget } from "@/lib/ingestion-budget";

export async function POST(request: Request) {
  try {
    const payload = sanitizeAnalytics(await readJsonBody(request, 4096));
    if (!payload) return new NextResponse(null, { status: 400, headers: { "Cache-Control": "no-store" } });
    if (!await consumeIngestionBudget("analytics")) {
      console.warn("Analytics event budget unavailable.");
      return new NextResponse(null, { status: 429, headers: { "Cache-Control": "no-store" } });
    }
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error("ANALYTICS_DB_UNAVAILABLE");
    const { error } = await supabase.from("analytics_events").insert(payload);
    if (error) throw new Error("ANALYTICS_INSERT_FAILED");
  } catch {
    // The browser telemetry caller never blocks navigation; non-2xx responses
    // and server logs make rejected writes observable without exposing payloads.
    console.warn("Analytics event was not stored.");
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
