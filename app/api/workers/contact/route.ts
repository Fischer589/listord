import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { readJsonBody } from "@/lib/http-json";
import { parseMatchRequest } from "@/lib/request-matching";
import { requestSummary } from "@/lib/request-specification";

const headers = { "Cache-Control": "private, no-store" };

/** Discovery contact is free. Existing payment/entitlement records are untouched. */
export async function POST(request: Request) {
  const body = await readJsonBody(request, 4096).catch(() => null) as { workerId?: unknown; draft?: unknown } | null;
  if (typeof body?.workerId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.workerId)) {
    return NextResponse.json({ error: "No pudimos preparar el contacto." }, { status: 400, headers });
  }
  const draft = body.draft === undefined ? null : parseMatchRequest(body.draft);
  if (body.draft !== undefined && !draft) return NextResponse.json({ error: "Revisa los detalles de tu solicitud." }, { status: 400, headers });
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error("unavailable");
    const { data, error } = await supabase.from("workers").select("full_name,whatsapp_number")
      .eq("id", body.workerId).eq("is_verified", true)
      .abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    if (error) throw new Error("unavailable");
    const url = data && buildWhatsAppUrl(data.whatsapp_number);
    if (!url) return NextResponse.json({ error: "Este contacto no está disponible." }, { status: 404, headers });
    if (draft && !data.full_name?.trim()) return NextResponse.json({ error: "Este contacto no está disponible." }, { status: 404, headers });
    const text = draft
      ? `Hola ${data.full_name.trim()}, vi tu perfil en ListoRD (${body.workerId}). Quisiera consultarte sobre este trabajo:\n\n${requestSummary(draft)}\n\n¿Podemos confirmar tu disponibilidad, las tareas, el horario y el pago?`
      : `Hola ${data.full_name?.trim() || ""}, vi tu perfil en ListoRD (${body.workerId}). ¿Podemos hablar de tu trabajo?`;
    return NextResponse.json({ url: `${url}?text=${encodeURIComponent(text)}`, reason: "free_contact", free_contacts_remaining: null }, { headers });
  } catch {
    return NextResponse.json({ error: "No pudimos abrir WhatsApp ahora mismo. Intenta de nuevo." }, { status: 503, headers });
  }
}
