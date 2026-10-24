// Synthetic server-side Supabase responses for the admin worker browser test.
const originalFetch = globalThis.fetch;
const pendingIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555"
];
const approvedId = "33333333-3333-4333-8333-333333333333";
const protectedIds = new Set([pendingIds[1], pendingIds[3]]);
const workers = [
  ...pendingIds.map((id, index) => ({ id, full_name: `Registro pendiente ${index + 1}`, is_verified: false })),
  { id: approvedId, full_name: "Perfil aprobado", is_verified: true }
].map(worker => ({
  ...worker, owner_user_id: null, photo_url: null, city: "Santiago",
  whatsapp_number: "+18090000000", skills: ["Limpieza"], desired_income: 1500,
  availability: [], work_style: "flexible", short_intro: "Perfil de prueba.",
  created_at: "2026-10-20T00:00:00Z"
}));
const failedOnce = new Set();

globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname !== "fixture.supabase.co") {
    return originalFetch(input, init);
  }
  const method = init?.method ?? "GET";
  if (url.pathname === "/rest/v1/workers" && (method === "GET" || method === "HEAD")) {
    const visible = workers.filter(worker => url.searchParams.get("is_verified") === null ||
        worker.is_verified === (url.searchParams.get("is_verified") === "eq.true"));
    const headers = { "content-type": "application/json", "content-range": visible.length ? `0-${visible.length - 1}/${visible.length}` : "*/0" };
    return Promise.resolve(method === "HEAD"
      ? new Response(null, { status: 200, headers })
      : Response.json(visible, { headers }));
  }
  if (url.pathname === "/rest/v1/rpc/admin_delete_pending_worker" && method === "POST") {
    const id = JSON.parse(String(init?.body)).p_worker_id;
    const index = workers.findIndex(row => row.id === id);
    if (index < 0 || workers[index].is_verified) return Promise.resolve(Response.json("not_pending"));
    if (protectedIds.has(id)) return Promise.resolve(Response.json("protected"));
    if (!failedOnce.has(id)) {
      failedOnce.add(id);
      return Promise.resolve(Response.json({ code: "XX000", message: "fixture database failure" }, { status: 500 }));
    }
    workers.splice(index, 1);
    return Promise.resolve(Response.json("deleted"));
  }
  throw new Error(`Unexpected worker fixture request ${method} ${url.pathname}`);
};
