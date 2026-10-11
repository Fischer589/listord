import assert from "node:assert/strict";
import test from "node:test";
import { POST, GET } from "../app/api/marketplace/route";
import { POST as contacts } from "../app/api/marketplace/contacts/route";

const actor = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
test("marketplace HTTP verifies Auth identity, binds RPC actor, protects contact and hides database errors", async () => {
  const names = ["MARKETPLACE_ENABLED", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const before = names.map(n => process.env[n]); const original = globalThis.fetch;
  Object.assign(process.env, { MARKETPLACE_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://marketplace-fixture.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_public", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  let confirmed = true; let fail = false; let calls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: actor, email_confirmed_at: confirmed ? "2026-01-01T00:00:00Z" : null });
    calls++;
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body)); assert.equal(body.p_actor, actor);
    if (fail) return Response.json({ message: "PRIVATE_DATABASE_DETAIL", code: "XX000" }, { status: 400 });
    if (url.pathname.endsWith("marketplace_contacts_v2")) return Response.json([{ name: "Fixture", phone: "18090000111", worker_id: id, worker_name: "Fixture worker" }]);
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
    const data = await response.json(); assert.match(data.contacts[0].url, /wa.me\/18090000111\?text=/);
    assert.equal(data.contacts[0].workerId, id);
    const message = new URL(data.contacts[0].url).searchParams.get("text")!;
    assert.match(message, /Fixture worker/); assert.ok(message.includes(id));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal((await GET(new Request("https://example.test/api/marketplace?mine=true"))).status, 401);
  } finally { globalThis.fetch = original; names.forEach((n, i) => { if (before[i] === undefined) delete process.env[n]; else process.env[n] = before[i]; }); }
});
