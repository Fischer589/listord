import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/http-json";
import { MARKETPLACE_HEADERS as headers, marketplaceEnabled, object, uuid } from "@/lib/marketplace";
import { MarketplaceError, marketplaceAdmin, rpcFailure, verifiedMarketplaceUser } from "@/lib/marketplace-server";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
export async function POST(request: Request) {
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Deshabilitado." }, { status: 503, headers });
  const b = object(await readJsonBody(request, 1024).catch(() => null));
  if (!uuid(b?.id)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400, headers });
  try {
    const actor = await verifiedMarketplaceUser(request);
    const { data, error } = await marketplaceAdmin().rpc("marketplace_contacts", { p_actor: actor, p_id: b.id }).abortSignal(AbortSignal.timeout(8000));
    rpcFailure(error);
    const contacts = (data as { name: string; phone: string }[]).flatMap(c => {
      const url = buildWhatsAppUrl(c.phone);
      const text = `Hola, participo en la oportunidad de ListoRD ${b.id}. ¿Podemos confirmar las tareas, horario y pago?`;
      return url ? [{ name: c.name, url: `${url}?text=${encodeURIComponent(text)}` }] : [];
    });
    return NextResponse.json({ contacts }, { headers });
  } catch (e) { return NextResponse.json({ error: e instanceof MarketplaceError ? e.message : "No se pudo abrir el contacto." }, { status: e instanceof MarketplaceError ? e.status : 503, headers }); }
}
