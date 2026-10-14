import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/http-json";
import { MARKETPLACE_HEADERS as headers, marketplaceEnabled, object, publication, PUBLIC_OPPORTUNITY_COLUMNS, uuid } from "@/lib/marketplace";
import { MarketplaceError, marketplaceAdmin, rpcFailure, verifiedMarketplaceUser } from "@/lib/marketplace-server";
import { featuredCheckoutReady, featuredReadEnabled } from "@/lib/marketplace-featured";
import { publicWorkerFields } from "@/lib/public-worker";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
function failure(e: unknown) { return e instanceof MarketplaceError ? json({ error: e.message }, e.status) : json({ error: "Servicio no disponible. No se confirmó ningún cambio." }, 503); }
export async function GET(request: Request) {
  if (!marketplaceEnabled()) return json({ error: "Las oportunidades están en preparación." }, 503);
  try {
    const url = new URL(request.url);
    const admin = marketplaceAdmin();
    if (url.searchParams.get("mine") === "true") {
      const actor = await verifiedMarketplaceUser(request);
      const [owned, workers, decisions] = await Promise.all([
        admin.from("marketplace_opportunity_owners").select(`opportunity_id,marketplace_opportunities!inner(${PUBLIC_OPPORTUNITY_COLUMNS},moderation_status)`).eq("owner_user_id", actor).is("marketplace_opportunities.deleted_at", null).order("created_at", { ascending: false }).limit(50).abortSignal(AbortSignal.timeout(8000)),
        admin.from("workers").select("id,full_name").eq("owner_user_id", actor).eq("is_verified", true).limit(20).abortSignal(AbortSignal.timeout(8000)),
        admin.from("marketplace_interests").select(`opportunity_id,worker_id,decision,marketplace_opportunities!inner(${PUBLIC_OPPORTUNITY_COLUMNS})`).eq("decision_user_id", actor).is("marketplace_opportunities.deleted_at", null).order("updated_at", { ascending: false }).limit(100).abortSignal(AbortSignal.timeout(8000))
      ]);
      if (owned.error || workers.error || decisions.error) throw new Error("unavailable");
      const opportunityIds = (owned.data ?? []).map(row => row.opportunity_id);
      const interests = opportunityIds.length ? await admin.from("marketplace_interests")
        .select("opportunity_id,worker_id,decision_user_id,created_at")
        .in("opportunity_id", opportunityIds).eq("decision", "interested")
        .order("created_at", { ascending: false }).limit(501).abortSignal(AbortSignal.timeout(8000))
        : { data: [], error: null };
      if (interests.error) throw new Error("unavailable");
      if ((interests.data?.length ?? 0) > 500) throw new Error("applicant list exceeds limit");
      const interestedWorkerIds = Array.from(new Set((interests.data ?? []).map(row => row.worker_id)));
      const interestedWorkers = interestedWorkerIds.length ? await admin.from("workers")
        .select("id,full_name,city,skills,owner_user_id").in("id", interestedWorkerIds)
        .eq("is_verified", true).abortSignal(AbortSignal.timeout(8000))
        : { data: [], error: null };
      if (interestedWorkers.error) throw new Error("unavailable");
      const byWorker = new Map((interestedWorkers.data ?? []).map(worker => [worker.id, worker]));
      const applicants = (interests.data ?? []).flatMap(interest => {
        const worker = byWorker.get(interest.worker_id);
        if (!worker || worker.owner_user_id !== interest.decision_user_id) return [];
        const preview = publicWorkerFields({ full_name: worker.full_name, city: worker.city, skills: worker.skills });
        return [{
          opportunity_id: interest.opportunity_id, worker_id: worker.id,
          full_name: preview.full_name, city: preview.city, skills: preview.skills,
          created_at: interest.created_at
        }];
      });
      let featured: { opportunity_id: string; status: string; featured_until: string | null }[] = [];
      if (featuredReadEnabled()) {
        const result = await admin.from("marketplace_featured_orders")
          .select("opportunity_id,status,featured_until").eq("owner_user_id", actor)
          .in("opportunity_id", opportunityIds.length ? opportunityIds : ["00000000-0000-0000-0000-000000000000"])
          .order("created_at", { ascending: false }).limit(100).abortSignal(AbortSignal.timeout(8000));
        if (result.error) throw new Error("unavailable");
        featured = result.data ?? [];
      }
      return json({ owned: owned.data, workers: workers.data, featured, featuredCheckoutAvailable: featuredCheckoutReady(request.url),
        decisions: decisions.data?.filter(d => workers.data?.some(w => w.id === d.worker_id)), applicants });
    }
    const id = url.searchParams.get("id");
    if (id && !uuid(id)) return json({ error: "Identificador inválido." }, 400);
    const now = new Date().toISOString();
    let query = admin.from("marketplace_opportunities").select(PUBLIC_OPPORTUNITY_COLUMNS).is("deleted_at", null).eq("status", "open").eq("moderation_status", "approved").gt("expires_at", now).order("created_at", { ascending: false }).limit(50);
    if (id) query = query.eq("id", id);
    const { data, error } = await query.abortSignal(AbortSignal.timeout(8000));
    if (error) throw new Error("unavailable");
    if (!featuredReadEnabled()) return json({ opportunities: data });
    const active = await admin.from("marketplace_featured_orders")
      .select("opportunity_id").eq("status", "paid").gt("featured_until", now)
      .order("paid_at", { ascending: false }).limit(50).abortSignal(AbortSignal.timeout(8000));
    if (active.error) throw new Error("unavailable");
    const ids = Array.from(new Set((active.data ?? []).map(row => row.opportunity_id)));
    const featured = ids.length ? await admin.from("marketplace_opportunities")
      .select(PUBLIC_OPPORTUNITY_COLUMNS).in("id", ids).is("deleted_at", null).eq("status", "open")
      .eq("moderation_status", "approved").gt("expires_at", now)
      .abortSignal(AbortSignal.timeout(8000)) : { data: [], error: null };
    if (featured.error) throw new Error("unavailable");
    const featuredById = new Map((featured.data ?? []).map(row => [row.id, row]));
    const leading = (id ? ids.filter(value => value === id) : ids).flatMap(value => {
      const row = featuredById.get(value);
      return row ? [{ ...row, featured: true }] : [];
    });
    const featuredIds = new Set(leading.map(row => row.id));
    return json({ opportunities: [...leading, ...(data ?? []).filter(row => !featuredIds.has(row.id)).map(row => ({ ...row, featured: false }))].slice(0, 50) });
  } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  if (!marketplaceEnabled()) return json({ error: "Las oportunidades están en preparación." }, 503);
  const b = object(await readJsonBody(request, 16000).catch(() => null));
  if (!b) return json({ error: "Solicitud inválida." }, 400);
  try {
    const actor = await verifiedMarketplaceUser(request);
    const admin = marketplaceAdmin();
    let name: string; let args: Record<string, unknown>;
    switch (b.action) {
      case "create": {
        const p = publication(b);
        if (!p) return json({ error: "Completa los términos, contacto privado y consentimiento de publicación." }, 400);
        name = "marketplace_create"; args = { p_actor: actor, p_key: p.key, p_draft: p.draft, p_name: p.name, p_phone: p.phone, p_consent: true }; break;
      }
      case "decide":
        if (!uuid(b.id) || !uuid(b.workerId) || !["interested", "declined", "withdrawn"].includes(String(b.decision))) return json({ error: "Decisión inválida." }, 400);
        name = "marketplace_decide"; args = { p_actor: actor, p_id: b.id, p_worker: b.workerId, p_decision: b.decision }; break;
      case "transition":
        if (!uuid(b.id) || !["closed", "filled"].includes(String(b.status))) return json({ error: "Estado inválido." }, 400);
        name = "marketplace_transition"; args = { p_actor: actor, p_id: b.id, p_status: b.status }; break;
      case "consent":
        if (!uuid(b.workerId) || typeof b.agree !== "boolean") return json({ error: "Consentimiento inválido." }, 400);
        name = "marketplace_consent"; args = { p_actor: actor, p_worker: b.workerId, p_agree: b.agree }; break;
      case "report":
        if (!uuid(b.id) || !["spam", "misleading", "unsafe", "privacy", "other"].includes(String(b.reason))) return json({ error: "Reporte inválido." }, 400);
        name = "marketplace_report"; args = { p_actor: actor, p_id: b.id, p_reason: b.reason }; break;
      default: return json({ error: "Operación inválida." }, 400);
    }
    const { data, error } = await admin.rpc(name, args).abortSignal(AbortSignal.timeout(8000));
    rpcFailure(error);
    return json({ saved: true, id: data ?? undefined });
  } catch (e) { return failure(e); }
}
