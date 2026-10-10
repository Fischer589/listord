const browserEvents = new Set([
  "request_started", "request_preview", "request_abandoned", "request_matches", "request_contact",
  "page_view", "worker_view", "contact_click", "paywall_open", "checkout_start",
  "boost_purchase_started", "boosted_profile_view", "boost_contact_initiated"
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const paths = new Set([
  "/", "/oportunidades", "/solicitar", "/empleadores", "/empleadores/mi-cuenta", "/employee-request-form",
  "/soluciones-empresariales", "/employer-deposit", "/employer-deposit/exitoso",
  "/payment/success", "/payment/cancel", "/resultados/gracias",
  "/trabajadores/registro", "/trabajadores/registro-exitoso", "/trabajadores/editar",
  "/trabajadores/recuperar", "/trabajadores/disponibilidad", "/trabajadores/nuevo",
  "/trabajadores/boost-exitoso", "/trabajadores/suscripcion-exitosa"
]);

/** Untrusted browser telemetry is never an authoritative payment event.
 * No URLs, free text, phones or capabilities may be stored here. */
export function sanitizeAnalytics(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (typeof input.event_name !== "string" || !browserEvents.has(input.event_name)) return null;
  const raw = input.metadata;
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const metadata: Record<string, string | number> = {};
  if (input.event_name.startsWith("request_")) {
    if (typeof source.elapsed_ms === "number" && Number.isInteger(source.elapsed_ms) && source.elapsed_ms >= 0 && source.elapsed_ms <= 3600000) metadata.elapsed_ms = source.elapsed_ms;
    if (typeof source.match_count === "number" && Number.isInteger(source.match_count) && source.match_count >= 0 && source.match_count <= 1000) metadata.match_count = source.match_count;
  }
  for (const key of ["session_id", "worker_id"]) {
    if (typeof source[key] === "string" && uuid.test(source[key])) metadata[key] = source[key];
  }
  if (typeof source.path === "string") {
    const path = source.path.split(/[?#]/, 1)[0];
    if (paths.has(path)) metadata.path = path;
    else if (/^\/trabajador\/[^/]+$/.test(path)) metadata.path = "/trabajador/[slug]";
    else if (/^\/categorias\/[^/]+(?:\/[^/]+)?$/.test(path)) metadata.path = "/categorias/[slug]";
    else if (/^\/resultados\/(empleador|trabajador)\/[^/]+$/.test(path)) metadata.path = "/resultados/[audience]/[requestId]";
  }
  if (source.plan === "weekly" || source.plan === "monthly") metadata.plan = source.plan;
  if (source.source === "business") metadata.source = "business";
  if (source.page === "soluciones-empresariales") metadata.page = "soluciones-empresariales";
  if (source.reason === "paywall_required") metadata.reason = "paywall_required";
  return { event_name: input.event_name, metadata };
}
