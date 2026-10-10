import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { readJsonBody } from "@/lib/http-json";
import { MARKETPLACE_HEADERS as headers, marketplaceEnabled, object, uuid } from "@/lib/marketplace";
import { marketplaceAdmin, rpcFailure } from "@/lib/marketplace-server";
import { availabilityRenewalEnabled } from "@/lib/availability";
import { dispatchOne, expressEnabled } from "@/lib/express";
import { outreachConfigured, sendExpressInvitation } from "@/lib/express-provider";
export async function GET() {
  await requireAdmin();
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Deshabilitado." }, { status: 503, headers });
  try {
    const { data, error } = await marketplaceAdmin().from("marketplace_express_orders").select("id,opportunity_id,status,channel,reference,amount,currency,paid_at,deadline,created_at").order("created_at", { ascending: false }).limit(100).abortSignal(AbortSignal.timeout(8000));
    if (error) throw error;
    return NextResponse.json({ orders: data }, { headers });
  } catch { return NextResponse.json({ error: "No se pudieron cargar las órdenes." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  await requireAdmin();
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Deshabilitado." }, { status: 503, headers });
  const b = object(await readJsonBody(request, 2048).catch(() => null));
  if (!b || !uuid(b.id)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400, headers });
  try {
    const admin = marketplaceAdmin();
    const rpc = async (name: string, args: Record<string, unknown>) => { const result = await admin.rpc(name, args).abortSignal(AbortSignal.timeout(8000)); rpcFailure(result.error); return result.data; };
    if (b.action === "dispatch") {
      if (!expressEnabled() || !outreachConfigured() || !availabilityRenewalEnabled()) throw new Error();
      let acceptedCount = 0;
      const until = Date.now() + 15000;
      for (let i = 0; i < 20 && Date.now() < until; i++) {
        const result = await dispatchOne({ claim: async () => (await rpc("marketplace_express_claim", { p_order: b.id }))?.[0] ?? null, record: async (worker, receipt) => { await rpc("marketplace_express_sent", { p_order: b.id, p_worker: worker, p_receipt: receipt }); } }, sendExpressInvitation);
        if (!result.sent) break;
        acceptedCount++;
      }
      return NextResponse.json({ sent: acceptedCount > 0, acceptedCount }, { headers });
    }
    if (b.action === "reconcile") {
      const status = await rpc("marketplace_express_reconcile", { p_order: b.id });
      return NextResponse.json({ status }, { headers });
    }
    if (b.evidenceConfirmed !== true || typeof b.reference !== "string" || !/^[A-Za-z0-9:_-]{5,160}$/.test(b.reference) || typeof b.operator !== "string" || !/^[A-Za-z0-9_-]{3,60}$/.test(b.operator)) return NextResponse.json({ error: "Confirma evidencia externa, referencia única y responsable. No pegues documentos ni datos bancarios." }, { status: 400, headers });
    if (b.action === "transfer_paid") {
      await rpc("marketplace_express_paid", { p_order: b.id, p_channel: "transfer", p_reference: b.reference, p_event: `transfer:${b.reference}`, p_amount: b.amount, p_currency: b.currency, p_actor_label: `admin:${b.operator}` });
      await rpc("marketplace_express_reconcile", { p_order: b.id });
    } else if (b.action === "refund_recorded") {
      await rpc("marketplace_express_refund", { p_order: b.id, p_reference: b.reference, p_event: `refund:${b.reference}`, p_actor_label: `admin:${b.operator}` });
    } else return NextResponse.json({ error: "Operación inválida." }, { status: 400, headers });
    return NextResponse.json({ saved: true }, { headers });
  } catch { return NextResponse.json({ error: "Operación no confirmada. Reconciliar antes de reintentar; nunca volver a enviar una invitación incierta." }, { status: 409, headers }); }
}
