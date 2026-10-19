import { NextResponse } from "next/server";
import { isUuid } from "@/lib/employer-workspace";
import { contactCreditStatus, ContactAccessError } from "@/lib/workspace-contact-access";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

/** Status only. A checkout redirect cannot activate contact. */
export async function GET(request: Request) {
  const workerId = new URL(request.url).searchParams.get("worker");
  if (!isUuid(workerId)) return NextResponse.json({ error: "Trabajador no válido." }, { status: 400, headers });
  try {
    const { db, active, remaining, alreadyUnlocked, canUnlock, unavailable } = await contactCreditStatus(request, workerId);
    if (!active) return NextResponse.json({ active: false, remaining, canUnlock, alreadyUnlocked, unavailable }, { headers });
    const worker = await db.from("workers").select("whatsapp_number").eq("id", workerId).eq("is_verified", true).maybeSingle();
    if (worker.error) return NextResponse.json({ error: "No se pudo verificar el contacto." }, { status: 503, headers });
    if (!worker.data || !buildWhatsAppUrl(worker.data.whatsapp_number)) return NextResponse.json({ active: false, unavailable: true }, { headers });
    return NextResponse.json({ active: true, remaining, alreadyUnlocked }, { headers });
  } catch (error) {
    if (error instanceof ContactAccessError && error.status === 402) return NextResponse.json({ active: false }, { headers });
    return NextResponse.json({ error: "No se pudo verificar el acceso." }, { status: error instanceof ContactAccessError ? error.status : 503, headers });
  }
}
