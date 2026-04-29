import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedEvents = new Set([
  "page_view",
  "worker_view",
  "contact_click",
  "paywall_open",
  "checkout_start",
  "checkout_success"
]);

function safeAnalyticsResponse() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdminClient();

    if (!supabase) {
      console.warn("Analytics event skipped: Supabase is not configured.");
      return safeAnalyticsResponse();
    }

    const body = (await request.json().catch(() => null)) as {
      event_name?: string;
      metadata?: Record<string, unknown>;
    } | null;
    const eventName = body?.event_name?.trim();

    if (!eventName || !allowedEvents.has(eventName)) {
      console.warn("Analytics event skipped: invalid event name.", eventName);
      return safeAnalyticsResponse();
    }

    const metadata =
      body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

    const { error } = await supabase
      .from("analytics_events")
      .insert({
        event_name: eventName,
        metadata
      });

    if (error) {
      console.warn("Analytics event insert failed.", {
        code: error.code
      });
      return safeAnalyticsResponse();
    }

    return safeAnalyticsResponse();
  } catch (error) {
    console.warn("Analytics event logging failed.", {
      name: error instanceof Error ? error.name : "UnknownError"
    });
    return safeAnalyticsResponse();
  }
}
