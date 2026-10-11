import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { checkoutParameters, dispatchOne, expressCheckoutUrl, expressEnabled, verifiedExpressPayment, type ExpressOrder, type Invitation } from "../lib/express";
import { sendExpressInvitation } from "../lib/express-provider";
import { GET, POST } from "../app/api/marketplace/route";
import { POST as checkout } from "../app/api/express/route";
import { verifiedMarketplaceUser } from "../lib/marketplace-server";

const id = "11111111-1111-4111-8111-111111111111";
const order: ExpressOrder = { id, opportunity_id: id, channel: "stripe", status: "payment_pending", reference: id, created_at: "2026-10-09T12:00:00.000Z", checkout_session_id: null };
test("Express hosted checkout uses stable one-time DOP parameters, bounded retries, and no implicit subscription", () => {
  const a = checkoutParameters(order, "https://example.test", Date.parse(order.created_at));
  const b = checkoutParameters(order, "https://example.test", Date.parse(order.created_at) + 600000);
  assert.deepEqual(a, b); assert.equal(a.mode, "payment"); assert.equal(a.client_reference_id, id);
  assert.equal(a.line_items?.[0]?.price_data?.unit_amount, 29900); assert.equal(a.line_items?.[0]?.price_data?.currency, "dop");
  assert.equal(a.line_items?.[0]?.price_data?.recurring, undefined); assert.equal(a.adaptive_pricing?.enabled, false);
  for (const origin of ["http://example.test", "https://user:pass@example.test", "https://example.test/?q=x"]) assert.throws(() => checkoutParameters(order, origin, Date.parse(order.created_at)));
  assert.throws(() => checkoutParameters(order, "https://example.test", Date.parse(order.created_at) + 1800001));
  assert.throws(() => checkoutParameters({ ...order, status: "paid" }, "https://example.test", Date.parse(order.created_at)));
});

test("Checkout URL is returned only for the exact open RD$299 Express session", () => {
  const session = { id: "cs_test_fixture", mode: "payment", status: "open", client_reference_id: id,
    metadata: { purpose: "listord_express", order_id: id }, amount_total: 29900,
    currency: "dop", url: "https://checkout.stripe.com/c/pay/cs_test_fixture" } as unknown as Stripe.Checkout.Session;
  assert.equal(expressCheckoutUrl(session, id), session.url);
  for (const change of [{ client_reference_id: "other" }, { metadata: { purpose: "other", order_id: id } },
    { amount_total: 100 }, { currency: "usd" }, { status: "complete" },
    { url: "https://evil.example/c/pay/cs_test_fixture" }]) {
    assert.equal(expressCheckoutUrl({ ...session, ...change } as Stripe.Checkout.Session, id), null);
  }
});

test("signed Express events require paid status, exact amount/currency and bound order identity", () => {
  const stripe = new Stripe("sk_test_fixture_only");
  const event = { id: "evt_fixture", type: "checkout.session.completed", data: { object: { id: "cs_test_fixture", mode: "payment", payment_status: "paid", amount_total: 29900, currency: "dop", payment_intent: "pi_fixture", client_reference_id: id, metadata: { purpose: "listord_express", order_id: id } } } };
  const payload = JSON.stringify(event); const secret = "fixture_webhook_secret_not_live";
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const verified = stripe.webhooks.constructEvent(payload, signature, secret);
  assert.equal(verifiedExpressPayment(verified)?.order, id);
  assert.throws(() => stripe.webhooks.constructEvent(payload.replace("29900", "29901"), signature, secret));
  for (const change of [{ payment_status: "unpaid" }, { amount_total: 1 }, { currency: "usd" }, { mode: "subscription" }, { client_reference_id: "other" }, { payment_intent: null }]) {
    assert.throws(() => verifiedExpressPayment({ ...event, data: { object: { ...event.data.object, ...change } } } as unknown as Stripe.Event));
  }
  assert.equal(verifiedExpressPayment({ ...event, type: "customer.created" } as unknown as Stripe.Event), null);
});

test("dispatch commits a one-shot claim before transport; uncertain provider result or DB acknowledgment never resends", async () => {
  const invitation: Invitation = { worker_id: id, phone: "18090000111", opportunity_id: id };
  let claimed = false; let calls = 0; let recorded = 0;
  const store = { claim: async () => { if (claimed) return null; claimed = true; return invitation; }, record: async () => { recorded++; } };
  const send = async () => { assert.equal(claimed, true); calls++; throw new Error("timeout after acceptance"); };
  await assert.rejects(dispatchOne(store, send));
  assert.deepEqual(await dispatchOne(store, send), { sent: false }); assert.equal(calls, 1); assert.equal(recorded, 0);
  claimed = false;
  await assert.rejects(dispatchOne({ ...store, record: async () => { throw new Error("DB unavailable"); } }, async () => { calls++; return "wamid.fixture"; }));
  await dispatchOne(store, send); assert.equal(calls, 2);
  claimed = false;
  assert.deepEqual(await dispatchOne(store, async () => "wamid.fixture2"), { sent: true }); assert.equal(recorded, 1);
});

test("Meta adapter preserves opportunity and selected worker in one public URL; acceptance is not a response", async () => {
  const names = ["WHATSAPP_GRAPH_VERSION", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_EXPRESS_TEMPLATE", "WHATSAPP_ACCESS_TOKEN", "APP_ORIGIN"];
  const previous = names.map(n => process.env[n]);
  Object.assign(process.env, { WHATSAPP_GRAPH_VERSION: "v99.0", WHATSAPP_PHONE_NUMBER_ID: "123456789", WHATSAPP_EXPRESS_TEMPLATE: "fixture_template", WHATSAPP_ACCESS_TOKEN: "fixture_not_live", APP_ORIGIN: "https://example.test" });
  try {
    const receipt = await sendExpressInvitation({ worker_id: id, phone: "+18090000111", opportunity_id: id }, async (url, options) => {
      assert.equal(String(url), "https://graph.facebook.com/v99.0/123456789/messages");
      assert.equal(options?.redirect, "error");
      const body = JSON.parse(String(options?.body)); assert.equal(body.type, "template");
      assert.equal(body.template.components[0].parameters[0].text, `https://example.test/oportunidades?id=${id}&worker=${id}`);
      assert.ok(!String(options?.body).includes("token="));
      return new Response(JSON.stringify({ messages: [{ id: "wamid.fixture" }] }));
    });
    assert.equal(receipt, "wamid.fixture");
    await assert.rejects(sendExpressInvitation({ worker_id: id, phone: "+18090000111", opportunity_id: id }, async () => new Response("{}", { status: 429 })));
  } finally { names.forEach((n, i) => { if (previous[i] === undefined) delete process.env[n]; else process.env[n] = previous[i]; }); }
});

test("marketplace and payment gates fail before data, auth or provider calls; verified identity cannot come from JSON", async () => {
  const old = process.env.MARKETPLACE_ENABLED; const oldExpress = process.env.EXPRESS_ENABLED;
  process.env.MARKETPLACE_ENABLED = "false"; process.env.EXPRESS_ENABLED = "false";
  try {
    assert.equal(expressEnabled(), false);
    assert.equal((await GET(new Request("https://example.test/api/marketplace"))).status, 503);
    const request = () => new Request("https://example.test/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "decide", actor: id }) });
    assert.equal((await POST(request())).status, 503); assert.equal((await checkout(request())).status, 503);
    process.env.MARKETPLACE_ENABLED = "true";
    assert.equal((await POST(request())).status, 401);
    await assert.rejects(verifiedMarketplaceUser(new Request("https://example.test", { headers: { Authorization: "Bearer arbitrary" } })), /verificada/);
  } finally { if (old === undefined) delete process.env.MARKETPLACE_ENABLED; else process.env.MARKETPLACE_ENABLED = old; if (oldExpress === undefined) delete process.env.EXPRESS_ENABLED; else process.env.EXPRESS_ENABLED = oldExpress; }
});

test("real webhook handler verifies signatures and session binding before Express paid/reconcile RPCs", async () => {
  const { POST: webhook } = await import("../app/api/stripe/webhook/route");
  const names = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const old = names.map(n => process.env[n]); const original = globalThis.fetch;
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "fixture_webhook", NEXT_PUBLIC_SUPABASE_URL: "https://express-fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const stripe = new Stripe("sk_test_fixture"); let mismatch = false; let missing = false; const writes: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (init?.method === "GET") return Response.json({ checkout_session_id: missing ? null : mismatch ? "cs_other" : "cs_fixture" });
    const body = JSON.parse(String(init?.body)); assert.equal(body.p_order, id);
    writes.push(path);
    if (path.endsWith("marketplace_express_paid")) { assert.equal(body.p_reference, "pi_fixture"); assert.equal(body.p_amount, 29900); assert.equal(body.p_currency, "dop"); return new Response(null, { status: 204 }); }
    assert.ok(path.endsWith("marketplace_express_reconcile")); return Response.json("paid");
  };
  const event = { id: "evt_fixture", created: Math.floor(Date.now()/1000), type: "checkout.session.completed", data: { object: { id: "cs_fixture", mode: "payment", payment_status: "paid", amount_total: 29900, currency: "dop", payment_intent: "pi_fixture", client_reference_id: id, metadata: { purpose: "listord_express", order_id: id } } } };
  const payload = JSON.stringify(event);
  const deliver = (body = payload, signature = stripe.webhooks.generateTestHeaderString({ payload, secret: "fixture_webhook" })) => webhook(new Request("https://example.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body }));
  try {
    assert.equal((await deliver(payload.replace("29900", "29901"))).status, 400); assert.equal(writes.length, 0);
    missing = true; assert.equal((await deliver()).status, 503); assert.equal(writes.length, 0);
    missing = false;
    mismatch = true; assert.equal((await deliver()).status, 503); assert.equal(writes.length, 0);
    mismatch = false; assert.equal((await deliver()).status, 200); assert.equal(writes.length, 2);
    assert.equal((await deliver()).status, 200); assert.deepEqual(writes.slice(0,2), writes.slice(2));
    assert.equal((await deliver("x".repeat(65537))).status, 400); assert.equal(writes.length, 4);
  } finally { globalThis.fetch = original; names.forEach((n, i) => { if (old[i] === undefined) delete process.env[n]; else process.env[n] = old[i]; }); }
});
