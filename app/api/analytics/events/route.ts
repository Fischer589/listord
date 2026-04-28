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

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no está configurado para analytics." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    event_name?: string;
    metadata?: Record<string, unknown>;
  } | null;
  const eventName = body?.event_name?.trim();

  if (!eventName || !allowedEvents.has(eventName)) {
    return NextResponse.json(
      { error: "Evento invalido." },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "No pudimos registrar el evento." },
      { status: 500 }
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("ListoRD analytics event:", {
      eventName,
      metadata
    });
  }

  return NextResponse.json({ ok: true });
}
