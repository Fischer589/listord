import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { POST as checkout } from "../app/api/stripe/employer-deposit-checkout/route";
import { POST as webhook } from "../app/api/stripe/webhook/route";
import { POST as premiumCheckout } from "../app/api/stripe/checkout/route";
import { POST as workerCheckout } from "../app/api/stripe/worker-checkout/route";
import { POST as boostCheckout } from "../app/api/stripe/boost-checkout/route";

const names = ["EMPLOYER_DEPOSIT_ENABLED", "LEGACY_CHECKOUT_ENABLED", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "APP_ORIGIN"];

test("employer deposit stays separate from legacy sales and fails closed before Stripe when dependencies are missing", async () => {
  const old = names.map(name => process.env[name]);
  try {
    process.env.LEGACY_CHECKOUT_ENABLED = "true";
    delete process.env.EMPLOYER_DEPOSIT_ENABLED;
    assert.equal((await checkout(new Request("https://example.test/api/stripe/employer-deposit-checkout", { method: "POST" }))).status, 503);

    process.env.EMPLOYER_DEPOSIT_ENABLED = "true";
    process.env.LEGACY_CHECKOUT_ENABLED = "false";
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
    for (const route of [premiumCheckout, workerCheckout, boostCheckout]) {
      assert.equal((await route(new Request("https://example.test/api/stripe/other-checkout", { method: "POST" }))).status, 503);
    }
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal((await checkout(new Request("https://example.test/api/stripe/employer-deposit-checkout", { method: "POST" }))).status, 503);

    process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture_service";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://deposit-fixture.example.test";
    process.env.APP_ORIGIN = "http://unsafe.example.test";
    assert.equal((await checkout(new Request("https://example.test/api/stripe/employer-deposit-checkout", { method: "POST" }))).status, 503);
  } finally {
    names.forEach((name, index) => { if (old[index] === undefined) delete process.env[name]; else process.env[name] = old[index]; });
  }
});

test("signed employer deposit webhooks require an existing row, exact payment, and one confirmed update", async () => {
  const old = names.map(name => process.env[name]);
  const oldFetch = globalThis.fetch;
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "fixture_webhook", NEXT_PUBLIC_SUPABASE_URL: "https://deposit-fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const stripe = new Stripe("sk_test_fixture");
  let row: "missing" | "pending" | "paid" = "pending";
  let updates = 0;
  let acknowledgeUpdate = true;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/rest/v1/employer_payments");
    if (init?.method === "GET") return Response.json(row === "missing" ? null : { status: row });
    assert.equal(init?.method, "PATCH");
    assert.equal(url.searchParams.get("status"), "eq.pending");
    assert.equal(url.searchParams.get("stripe_session_id"), "eq.cs_test_deposit_fixture");
    updates++;
    if (!acknowledgeUpdate) return Response.json(null);
    row = "paid";
    return Response.json({ id: "00000000-0000-4000-8000-000000000001" });
  };
  const session = { id: "cs_test_deposit_fixture", mode: "payment", payment_status: "paid", amount_total: 300000, currency: "dop", payment_intent: "pi_fixture", metadata: { purpose: "employer_deposit" }, customer_details: { name: "Test Employer", email: "test@example.test", phone: null } };
  async function deliver(type = "checkout.session.completed", changes: Record<string, unknown> = {}, validSignature = true) {
    const payload = JSON.stringify({ id: "evt_fixture", type, data: { object: { ...session, ...changes } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: validSignature ? "fixture_webhook" : "wrong_secret" });
    return webhook(new Request("https://example.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body: payload }));
  }
  try {
    assert.equal((await deliver(undefined, {}, false)).status, 400);
    assert.equal((await deliver(undefined, { payment_status: "unpaid" })).status, 200);
    assert.equal(updates, 0);
    assert.equal((await deliver(undefined, { amount_total: 300001 })).status, 400);
    assert.equal(updates, 0);
    row = "missing";
    assert.equal((await deliver()).status, 503);
    assert.equal(updates, 0);
    row = "pending";
    acknowledgeUpdate = false;
    assert.equal((await deliver()).status, 500);
    assert.equal(updates, 1);
    acknowledgeUpdate = true;
    assert.equal((await deliver("checkout.session.async_payment_succeeded")).status, 200);
    assert.equal(updates, 2);
    assert.equal((await deliver()).status, 200);
    assert.equal(updates, 2);
  } finally {
    globalThis.fetch = oldFetch;
    names.forEach((name, index) => { if (old[index] === undefined) delete process.env[name]; else process.env[name] = old[index]; });
  }
});
