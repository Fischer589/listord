import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { POST as checkout } from "../app/api/stripe/featured-opportunity-checkout/route";
import { POST as webhook } from "../app/api/stripe/webhook/route";

const owner = "11111111-1111-4111-8111-111111111111";
const stranger = "22222222-2222-4222-8222-222222222222";
const opportunity = "33333333-3333-4333-8333-333333333333";
const orderId = "44444444-4444-4444-8444-444444444444";
const sessionId = "cs_test_featured_fixture";
const intent = "pi_featured_fixture";
const endpoint = "https://release-candidate--listord-2.netlify.app";
const session = { id: sessionId, mode: "payment", payment_status: "paid", status: "complete",
  amount_total: 14900, currency: "dop", payment_intent: intent, client_reference_id: owner,
  metadata: { purpose: "marketplace_featured_7d", order_id: orderId, owner_user_id: owner, opportunity_id: opportunity } };

test("featured checkout authorizes the owner, fixes one-time RD$149 terms, and signed webhook grants once then revokes", async () => {
  const names = ["MARKETPLACE_ENABLED", "FEATURED_OPPORTUNITIES_ENABLED", "FEATURED_CHECKOUT_ENABLED", "FEATURED_LIVE_PAYMENTS_ENABLED", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "APP_ORIGIN", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const old = names.map(name => process.env[name]);
  const oldFetch = globalThis.fetch;
  Object.assign(process.env, { MARKETPLACE_ENABLED: "true", FEATURED_OPPORTUNITIES_ENABLED: "true", FEATURED_CHECKOUT_ENABLED: "true",
    FEATURED_LIVE_PAYMENTS_ENABLED: "false", STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "featured_fixture",
    APP_ORIGIN: endpoint, NEXT_PUBLIC_SUPABASE_URL: "https://fixture.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_anon",
    SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const stripe = new Stripe("sk_test_fixture");
  const sessions = Object.getPrototypeOf(stripe.checkout.sessions);
  const originalCreate = sessions.create;
  const originalRetrieve = sessions.retrieve;
  const originalList = sessions.list;
  let bound = false;
  let status = "pending";
  let paymentIntent: string | null = null;
  let granted = 0;
  let created = 0;
  let authorized = owner;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: authorized, email_confirmed_at: "2026-01-01T00:00:00Z", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
    if (url.pathname === "/rest/v1/rpc/marketplace_featured_reserve") {
      return authorized === owner ? Response.json(orderId) : Response.json({ message: "NOT_ELIGIBLE", code: "P0001" }, { status: 400 });
    }
    if (url.pathname === "/rest/v1/rpc/marketplace_featured_paid") {
      const args = JSON.parse(String(init?.body));
      assert.equal(args.p_session, sessionId); assert.equal(args.p_intent, intent);
      if (status === "refunded") return Response.json("refunded");
      if (status === "paid") return Response.json("already_paid");
      assert.equal(args.p_paid_at, "2026-10-13T12:00:00.000Z");
      status = "paid"; paymentIntent = intent; granted++;
      return Response.json("activated");
    }
    if (url.pathname === "/rest/v1/rpc/marketplace_featured_fail") {
      if (status === "pending") status = "failed";
      return Response.json(null);
    }
    if (url.pathname === "/rest/v1/rpc/marketplace_featured_refund") {
      const args = JSON.parse(String(init?.body));
      assert.equal(args.p_intent, intent);
      status = "refunded"; paymentIntent = intent;
      return Response.json(null);
    }
    assert.equal(url.pathname, "/rest/v1/marketplace_featured_orders");
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      assert.equal(body.stripe_session_id, sessionId);
      bound = true;
      return Response.json({ id: orderId });
    }
    if (url.searchParams.has("stripe_payment_intent_id")) return Response.json(paymentIntent ? { id: orderId, stripe_session_id: sessionId } : null);
    return Response.json({ id: orderId, owner_user_id: owner, opportunity_id: opportunity, status,
      stripe_session_id: bound ? sessionId : null, amount: 14900, currency: "dop",
      stripe_payment_intent_id: paymentIntent, created_at: new Date().toISOString() });
  };
  sessions.create = async (params: Record<string, unknown>, options: { idempotencyKey: string }) => {
    created++;
    assert.equal(params.mode, "payment");
    assert.deepEqual(params.payment_method_types, ["card"]);
    assert.equal((params.line_items as Array<{price_data:{unit_amount:number;currency:string}}>)[0].price_data.unit_amount, 14900);
    assert.equal((params.line_items as Array<{price_data:{unit_amount:number;currency:string}}>)[0].price_data.currency, "dop");
    assert.equal((params.metadata as Record<string,string>).opportunity_id, opportunity);
    assert.equal(options.idempotencyKey, `featured:${orderId}`);
    assert.match(String(params.success_url), /featured=return$/);
    assert.doesNotMatch(JSON.stringify(params), /subscription|recurring/);
    return { id: sessionId, url: `https://checkout.stripe.com/c/pay/${sessionId}` };
  };
  sessions.retrieve = async () => ({ ...session, status: "open", url: `https://checkout.stripe.com/c/pay/${sessionId}` });
  sessions.list = async () => ({ data: [session] });
  const buy = () => checkout(new Request(`${endpoint}/api/stripe/featured-opportunity-checkout`, { method: "POST",
    headers: { Authorization: "Bearer fixture_token_12345678901234567890", "Content-Type": "application/json" },
    body: JSON.stringify({ opportunityId: opportunity }) }));
  async function deliver(type: string, object: Record<string, unknown> = session, eventId = "evt_featured_fixture") {
    const payload = JSON.stringify({ id: eventId, type, created: Date.parse("2026-10-13T12:00:00Z") / 1000, data: { object } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: "featured_fixture" });
    return webhook(new Request(`${endpoint}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": signature }, body: payload }));
  }
  try {
    assert.equal((await checkout(new Request(`${endpoint}/api/stripe/featured-opportunity-checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId: opportunity }) }))).status, 401);
    authorized = stranger;
    assert.equal((await buy()).status, 403);
    assert.equal(created, 0);
    authorized = owner;
    const response = await buy();
    assert.equal(response.status, 200);
    assert.match((await response.json()).url, /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(created, 1);
    assert.equal((await buy()).status, 200);
    assert.equal(created, 1);
    assert.equal((await deliver("checkout.session.completed", { ...session, payment_status: "unpaid" })).status, 200);
    assert.equal(granted, 0);
    assert.equal((await deliver("checkout.session.completed", { ...session, amount_total: 14901 })).status, 503);
    assert.equal((await deliver("checkout.session.completed", { ...session, client_reference_id: stranger })).status, 503);
    assert.equal(granted, 0);
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    assert.equal(status, "paid"); assert.equal(granted, 1);
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    assert.equal(granted, 1);
    assert.equal((await deliver("checkout.session.expired", { ...session, payment_status: "unpaid" })).status, 200);
    assert.equal(status, "paid");
    assert.equal((await deliver("charge.refunded", { payment_intent: intent }, "evt_refund")).status, 200);
    assert.equal(status, "refunded");
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    assert.equal(status, "refunded"); assert.equal(granted, 1);
    status = "pending"; paymentIntent = null;
    assert.equal((await deliver("charge.refunded", { payment_intent: intent }, "evt_refund_early")).status, 200);
    assert.equal(status, "refunded");
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    assert.equal(status, "refunded");
    status = "pending"; paymentIntent = null;
    assert.equal((await deliver("checkout.session.async_payment_failed", { ...session, payment_status: "unpaid" })).status, 200);
    assert.equal(status, "failed");
    status = "pending";
    sessions.retrieve = async () => ({ ...session, status: "expired" });
    assert.equal((await buy()).status, 409);
    assert.equal(status, "failed");
  } finally {
    sessions.create = originalCreate; sessions.retrieve = originalRetrieve; sessions.list = originalList;
    globalThis.fetch = oldFetch;
    names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]; });
  }
});
