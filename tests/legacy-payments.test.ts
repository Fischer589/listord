import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { POST } from "../app/api/stripe/webhook/route";

test("legacy premium signed webhook rejects unpaid access and duplicate delivery cannot extend or overwrite entitlements", async () => {
  const names = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const old = names.map(n => process.env[n]); const oldFetch = globalThis.fetch;
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "fixture_webhook", NEXT_PUBLIC_SUPABASE_URL: "https://payments-fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const stripe = new Stripe("sk_test_fixture");
  const writes: Record<string, unknown>[] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(new URL(String(input)).pathname, "/rest/v1/premium_access");
    assert.match(new Headers(init?.headers).get("prefer") ?? "", /resolution=ignore-duplicates/);
    writes.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 201 });
  };
  const event = { id: "evt_fixture", created: 1791547200, type: "checkout.session.completed", data: { object: { id: "cs_fixture", payment_status: "paid", metadata: { plan: "weekly" }, customer: null, subscription: null } } };
  async function deliver(paid: boolean) {
    const payload = JSON.stringify({ ...event, data: { object: { ...event.data.object, payment_status: paid ? "paid" : "unpaid" } } });
    return POST(new Request("https://example.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: "fixture_webhook" }) }, body: payload }));
  }
  try {
    assert.equal((await deliver(false)).status, 200); assert.equal(writes.length, 0);
    assert.equal((await deliver(true)).status, 200); assert.equal((await deliver(true)).status, 200);
    assert.deepEqual(writes[0], writes[1]);
    assert.equal(writes[0].paid_access_until, new Date((event.created + 7 * 86400) * 1000).toISOString());
  } finally { globalThis.fetch = oldFetch; names.forEach((n, i) => { if (old[i] === undefined) delete process.env[n]; else process.env[n] = old[i]; }); }
});

test("return URL is read-only and phone/browser identifiers cannot inspect entitlements", async () => {
  const { GET: verify } = await import("../app/api/stripe/verify/route");
  const { GET: status } = await import("../app/api/premium/status/route");
  const oldFetch = globalThis.fetch;
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const old = names.map(n => process.env[n]);
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://payments-fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++; assert.equal(init?.method, "GET", "no payment return writes");
    return new Response("[]", { headers: { "Content-Type": "application/json" } });
  };
  try {
    assert.equal((await status()).status, 403); assert.equal(calls, 0);
    assert.equal((await verify(new Request("https://example.test/api/stripe/verify?session_id=short"))).status, 400);
    const result = await verify(new Request("https://example.test/api/stripe/verify?session_id=cs_test_123456789012345678901234"));
    assert.equal(result.status, 200); assert.equal((await result.json()).premium, false);
    assert.equal(result.headers.get("cache-control"), "private, no-store"); assert.equal(calls, 1);
  } finally { globalThis.fetch = oldFetch; names.forEach((n, i) => { if (old[i] === undefined) delete process.env[n]; else process.env[n] = old[i]; }); }
});
