import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { readJsonBody } from "@/lib/http-json";
import { MARKETPLACE_HEADERS as headers, marketplaceEnabled, object, uuid } from "@/lib/marketplace";
import { marketplaceAdmin, rpcFailure } from "@/lib/marketplace-server";
import { featuredReadEnabled } from "@/lib/marketplace-featured";
export async function GET() {
  await requireAdmin();
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Deshabilitado." }, { status: 503, headers });
  try {
    const admin = marketplaceAdmin();
    const columns = "id,category,scope,city,specification,starts_at,timing_note,duration_minutes,duration_note,compensation_kind,compensation_min,compensation_max,compensation_unit,created_at,expires_at,status,moderation_status";
    const [pending, approved, rejected, reports] = await Promise.all([
      admin.from("marketplace_opportunities").select(columns, { count: "exact" }).eq("status", "draft").eq("moderation_status", "pending").order("created_at", { ascending: true }).limit(50).abortSignal(AbortSignal.timeout(8000)),
      admin.from("marketplace_opportunities").select(columns, { count: "exact" }).eq("moderation_status", "approved").order("created_at", { ascending: false }).limit(50).abortSignal(AbortSignal.timeout(8000)),
      admin.from("marketplace_opportunities").select(columns, { count: "exact" }).eq("moderation_status", "rejected").order("created_at", { ascending: false }).limit(50).abortSignal(AbortSignal.timeout(8000)),
      admin.from("marketplace_reports").select("id,opportunity_id,reason,created_at").eq("status", "pending").order("created_at").limit(100).abortSignal(AbortSignal.timeout(8000))
    ]);
    if (pending.error || approved.error || rejected.error) throw new Error("Opportunity review unavailable");
    if (reports.error) throw reports.error;
    const featured = featuredReadEnabled() ? await admin.from("marketplace_featured_orders")
      .select("id,opportunity_id,paid_at,featured_until,marketplace_opportunities(status,moderation_status,expires_at)")
      .eq("status", "paid").gt("featured_until", new Date().toISOString())
      .order("paid_at", { ascending: false }).limit(100).abortSignal(AbortSignal.timeout(8000)) : { data: [], error: null };
    if (featured.error) throw featured.error;
    const earlyClosures = (featured.data ?? []).filter(order => {
      const related = order.marketplace_opportunities;
      const opportunity = (Array.isArray(related) ? related[0] : related) as
        { status: string; moderation_status: string; expires_at: string } | null | undefined;
      return !opportunity || opportunity.status !== "open" || opportunity.moderation_status !== "approved" ||
        Date.parse(opportunity.expires_at) <= Date.now();
    }).map(order => ({ id: order.id, opportunity_id: order.opportunity_id,
      paid_at: order.paid_at, featured_until: order.featured_until }));
    return NextResponse.json({
      opportunities: [...(pending.data ?? []), ...(approved.data ?? []), ...(rejected.data ?? [])],
      counts: { pending: pending.count ?? 0, approved: approved.count ?? 0, rejected: rejected.count ?? 0 },
      reports: reports.data, earlyClosures
    }, { headers });
  } catch { return NextResponse.json({ error: "No se pudo cargar la revisión." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  await requireAdmin();
  if (!marketplaceEnabled()) return NextResponse.json({ error: "Deshabilitado." }, { status: 503, headers });
  const b = object(await readJsonBody(request, 2048).catch(() => null));
  if (b?.action === "link_owner") {
    if (!uuid(b.id) || !uuid(b.owner) || b.identityVerified !== true || typeof b.evidence !== "string" || !/^[A-Za-z0-9:_-]{5,160}$/.test(b.evidence) || typeof b.operator !== "string" || !/^[A-Za-z0-9_-]{3,60}$/.test(b.operator)) return NextResponse.json({ error: "Verifica al titular y registra la referencia privada de evidencia." }, { status: 400, headers });
    try {
      const admin = marketplaceAdmin();
      const verified = await admin.auth.admin.getUserById(b.owner);
      if (verified.error || !verified.data.user || verified.data.user.is_anonymous || !(verified.data.user.email_confirmed_at || verified.data.user.phone_confirmed_at)) throw new Error();
      const { error } = await admin.rpc("marketplace_link_owner", { p_worker: b.id, p_owner: b.owner, p_evidence: b.evidence, p_operator: b.operator }).abortSignal(AbortSignal.timeout(8000));
      rpcFailure(error); return NextResponse.json({ saved: true }, { headers });
    } catch { return NextResponse.json({ error: "No se vinculó el perfil. No se reemplaza un titular existente." }, { status: 409, headers }); }
  }
  if (b?.action === "resolve_report" && uuid(b.id) && typeof b.remove === "boolean") {
    try {
      const { error } = await marketplaceAdmin().rpc("marketplace_resolve_report", { p_report: b.id, p_remove: b.remove }).abortSignal(AbortSignal.timeout(8000));
      rpcFailure(error); return NextResponse.json({ saved: true }, { headers });
    } catch { return NextResponse.json({ error: "No se confirmó la revisión del reporte." }, { status: 409, headers }); }
  }
  if (!b || !uuid(b.id) || typeof b.approve !== "boolean" || (b.approve && b.privacyReviewed !== true)) return NextResponse.json({ error: "Revisa todos los campos: sin teléfonos, nombres privados, direcciones exactas ni datos sensibles." }, { status: 400, headers });
  try {
    const { error } = await marketplaceAdmin().rpc("marketplace_moderate", { p_id: b.id, p_approve: b.approve }).abortSignal(AbortSignal.timeout(8000));
    rpcFailure(error);
    return NextResponse.json({ saved: true }, { headers });
  } catch { return NextResponse.json({ error: "No se confirmó la revisión. Recarga antes de reintentar." }, { status: 409, headers }); }
}
