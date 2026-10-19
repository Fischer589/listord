import assert from "node:assert/strict";
import test from "node:test";
import { POST, GET } from "../app/api/marketplace/route";
import { POST as contacts } from "../app/api/marketplace/contacts/route";
import { workerContactMessage } from "../lib/whatsapp";

const actor = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
test("marketplace HTTP verifies Auth identity, binds RPC actor, protects contact and hides database errors", async () => {
  const names = ["MARKETPLACE_ENABLED", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const before = names.map(n => process.env[n]); const original = globalThis.fetch;
  Object.assign(process.env, { MARKETPLACE_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_fixture", NEXT_PUBLIC_SUPABASE_URL: "https://marketplace-fixture.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_public", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  let confirmed = true; let fail = false; let owns = true; let calls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: actor, email_confirmed_at: confirmed ? "2026-01-01T00:00:00Z" : null });
    if (url.pathname.endsWith("/employer_workspace_orders")) return Response.json([{ id: "paid-fixture" }]);
    if (url.pathname.endsWith("/marketplace_opportunities")) return Response.json({ id });
    if (url.pathname.endsWith("/marketplace_opportunity_owners")) return Response.json(owns ? { opportunity_id: id } : null);
    calls++;
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body)); assert.equal(body.p_actor, actor);
    if (fail) return Response.json({ message: "PRIVATE_DATABASE_DETAIL", code: "XX000" }, { status: 400 });
    if (url.pathname.endsWith("marketplace_contacts_v2")) return Response.json([
      { name: "Fixture", phone: "18090000111", worker_id: id, worker_name: "Fixture worker" },
      { name: "Other", phone: "18090000222", worker_id: "33333333-3333-4333-8333-333333333333", worker_name: "Other worker" }
    ]);
    assert.equal(body.p_decision, "interested");
    return new Response(null, { status: 204 });
  };
  const request = (body: unknown) => new Request("https://example.test/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer fixture_token_12345678901234567890" }, body: JSON.stringify(body) });
  try {
    const body = { action: "decide", id, workerId: id, decision: "interested", actor: id };
    const saved = await POST(request(body)); assert.equal(saved.status, 200); assert.equal((await saved.json()).saved, true);
    confirmed = false; assert.equal((await POST(request(body))).status, 401); assert.equal(calls, 1);
    confirmed = true; fail = true;
    const failed = await POST(request(body)); assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /PRIVATE_DATABASE_DETAIL/);
    fail = false;
    const response = await contacts(request({ id, workerId: id })); assert.equal(response.status, 200);
    const data = await response.json(); assert.equal(data.contacts.length, 1, "only the chosen worker is returned"); assert.match(data.contacts[0].url, /wa.me\/18090000111\?text=/);
    assert.equal(data.contacts[0].workerId, id);
    const message = new URL(data.contacts[0].url).searchParams.get("text")!;
    assert.equal(message, workerContactMessage("Fixture worker"));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    owns = false;
    assert.equal((await contacts(request({ id, workerId: id }))).status, 403, "an interested worker cannot reveal employer contact");
    assert.equal((await GET(new Request("https://example.test/api/marketplace?mine=true"))).status, 401);
  } finally { globalThis.fetch = original; names.forEach((n, i) => { if (before[i] === undefined) delete process.env[n]; else process.env[n] = before[i]; }); }
});

test("employer applicant view includes only current, verified responses to owned opportunities", async () => {
  const names = ["MARKETPLACE_ENABLED", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const before = names.map(n => process.env[n]); const original = globalThis.fetch;
  Object.assign(process.env, { MARKETPLACE_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://marketplace-fixture.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_public", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const other = "33333333-3333-4333-8333-333333333333";
  let overLimit = false;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: actor, email_confirmed_at: "2026-01-01T00:00:00Z" });
    if (url.pathname.endsWith("/marketplace_opportunity_owners")) return Response.json([{ opportunity_id: id, marketplace_opportunities: { id, status: "open", moderation_status: "approved" } }]);
    if (url.pathname.endsWith("/marketplace_interests")) return Response.json(url.searchParams.has("decision_user_id") ? [] : overLimit ? Array.from({ length: 501 }, () => ({ opportunity_id: id, worker_id: id, decision_user_id: actor, created_at: "2026-10-13T00:00:00Z" })) : [
      { opportunity_id: id, worker_id: id, decision_user_id: actor, created_at: "2026-10-13T00:00:00Z" },
      { opportunity_id: id, worker_id: other, decision_user_id: actor, created_at: "2026-10-13T00:00:00Z" }
    ]);
    if (url.pathname.endsWith("/workers")) return Response.json(url.searchParams.has("owner_user_id") ? [] : [
      { id, full_name: "Verified applicant", city: "Puerto Plata", skills: ["Limpieza"], owner_user_id: actor },
      { id: other, full_name: "Transferred profile", city: "Santo Domingo", skills: [], owner_user_id: other }
    ]);
    throw new Error(`Unexpected fixture query: ${url.pathname}`);
  };
  try {
    const request = new Request("https://example.test/api/marketplace?mine=true", { headers: { Authorization: "Bearer fixture_token_12345678901234567890" } });
    const response = await GET(request); assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.applicants, [{ opportunity_id: id, worker_id: id, full_name: "Verified applicant", city: "Puerto Plata", skills: ["Limpieza"], created_at: "2026-10-13T00:00:00Z" }]);
    assert.doesNotMatch(JSON.stringify(data), /Transferred profile|whatsapp_number|contact_name/);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    overLimit = true;
    const capped = await GET(request); assert.equal(capped.status, 503, "an incomplete applicant list is not presented as complete");
    assert.equal((await capped.json()).applicants, undefined);
  } finally { globalThis.fetch = original; names.forEach((n, i) => { if (before[i] === undefined) delete process.env[n]; else process.env[n] = before[i]; }); }
});
