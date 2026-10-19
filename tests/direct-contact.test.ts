import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";
import { POST as checkout } from "../app/api/stripe/direct-contact-checkout/route";
import { POST as webhook } from "../app/api/stripe/webhook/route";
import { POST as contact } from "../app/api/workers/contact/route";
import { POST as matchContact } from "../app/api/requests/contact/route";
import { POST as applicantContact } from "../app/api/marketplace/contacts/route";
import { GET as contactStatus } from "../app/api/contact-access/route";
import { emptyRequest } from "../lib/request-specification";
import { directContactCheckoutReady } from "../lib/direct-contact";
import { workerContactMessage } from "../lib/whatsapp";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "33333333-3333-4333-8333-333333333333";
const worker = "22222222-2222-4222-8222-222222222222";
const otherWorker = "55555555-5555-4555-8555-555555555555";
const orderId = "44444444-4444-4444-8444-444444444444";
const opportunity = "66666666-6666-4666-8666-666666666666";
const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", timing: "Fecha flexible", duration: "4 horas", amount: "1500", unit: "por día", answers: { property: "Casa", tasks: "Pisos y baños", supplies: "Los pongo yo" } };

test("direct orders migration is private, worker-bound, and does not alter existing workspace orders", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.workers(id uuid primary key);
      create table public.employer_workspace_orders(id uuid primary key);
      grant select on public.employer_workspace_orders to service_role;
      insert into auth.users values('${owner}'); insert into public.workers values('${worker}');
      insert into public.employer_workspace_orders values('${orderId}');`);
    await db.exec(await readFile(new URL("../supabase/migrations/202610141300_direct_contact_orders.sql", import.meta.url), "utf8"));
    await db.query("insert into public.employer_direct_contact_orders(owner_user_id,worker_id) values($1,$2)", [owner, worker]);
    await assert.rejects(db.query("insert into public.employer_direct_contact_orders(owner_user_id,worker_id) values($1,$2)", [owner, worker]), /employer_direct_contact_one_pending_idx/);
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from public.employer_direct_contact_orders"), /permission denied/);
    await db.exec("reset role; set role service_role");
    assert.equal((await db.query("select id from public.employer_direct_contact_orders")).rows.length, 1);
    assert.equal((await db.query("select id from public.employer_workspace_orders")).rows.length, 1);
  } finally { await db.close(); }
});

test("one paid direct order authorizes only its verified owner and worker across contact routes", async () => {
  const names = ["STRIPE_SECRET_KEY", "DIRECT_CONTACT_READ_ENABLED", "MARKETPLACE_ENABLED", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const before = names.map(name => process.env[name]);
  const fetchBefore = globalThis.fetch;
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_live_fixture", DIRECT_CONTACT_READ_ENABLED: "true", MARKETPLACE_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://direct-fixture.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_anon", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  let linkedOwner = owner;
  let status: "paid" | "failed" | "refunded" | "disputed" = "paid";
  let mode: "live" | "test" = "live";
  let workspaceActive = false;
  let privateReads = 0;
  const handoffs: Array<{order_id:string; product:string; route:string}> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/rest/v1/employer_contact_handoffs") {
      const row = JSON.parse(String(init?.body));
      assert.equal(JSON.stringify(row).includes("18095550100"), false);
      handoffs.push(row);
      return Response.json(null);
    }
    if (url.pathname === "/auth/v1/user") return Response.json({ id: linkedOwner, email_confirmed_at: "2026-01-01T00:00:00Z" });
    if (url.pathname === "/rest/v1/employer_workspace_orders") return Response.json(workspaceActive ? [{ id: "workspace" }] : []);
    if (url.pathname === "/rest/v1/employer_direct_contact_orders") {
      assert.equal(url.searchParams.get("status"), "eq.paid");
      assert.equal(url.searchParams.get("stripe_session_id"), "like.cs\\_live\\_%");
      return Response.json(status === "paid" && mode === "live" && linkedOwner === owner && url.searchParams.get("worker_id") === `eq.${worker}` ? [{ id: orderId }] : []);
    }
    privateReads++;
    if (url.pathname === "/rest/v1/workers") return Response.json({ id: worker, full_name: "Ana", city: "Puerto Plata", skills: ["Limpieza"],
      whatsapp_number: "18095550100", is_verified: true, available_now: true, created_at: new Date().toISOString(), desired_income: 1200, income_type: "daily" });
    if (url.pathname === "/rest/v1/marketplace_opportunities") return Response.json({ id: opportunity });
    if (url.pathname === "/rest/v1/marketplace_opportunity_owners") return Response.json({ opportunity_id: opportunity });
    if (url.pathname === "/rest/v1/rpc/marketplace_contacts_v2") return Response.json([{ worker_id: worker, worker_name: "Ana", name: "Ana", phone: "18095550100" }]);
    throw new Error(`Unexpected query: ${url.pathname} ${init?.method}`);
  };
  const req = (path: string, body: unknown, authenticated = true) => new Request(`https://example.test${path}`, { method: "POST",
    headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer fixture_token_12345678901234567890" } : {}) }, body: JSON.stringify(body) });
  const cases = [
    [contact, "/api/workers/contact", { workerId: worker }],
    [matchContact, "/api/requests/contact", { workerId: worker, draft }],
    [applicantContact, "/api/marketplace/contacts", { workerId: worker, id: opportunity }],
  ] as const;
  try {
    for (const [handler, path, body] of cases) {
      assert.equal((await handler(req(path, body, false))).status, 401);
      const allowed = await handler(req(path, body));
      assert.equal(allowed.status, 200);
      const result = await allowed.json();
      const url = new URL(path === "/api/marketplace/contacts" ? result.contacts[0].url : result.url);
      assert.equal(url.pathname, "/18095550100");
      assert.equal(url.searchParams.get("text"), workerContactMessage("Ana"));
    }
    assert.deepEqual(handoffs, [
      { order_id: orderId, product: "direct", route: "worker" },
      { order_id: orderId, product: "direct", route: "request" },
      { order_id: orderId, product: "direct", route: "marketplace" }
    ]);
    const statusRequest = (id: string) => new Request(`https://example.test/api/contact-access?worker=${id}`, { headers: { Authorization: "Bearer fixture_token_12345678901234567890" } });
    assert.deepEqual(await (await contactStatus(statusRequest(worker))).json(), { active: true });
    const reads = privateReads;
    assert.equal((await contact(req("/api/workers/contact", { workerId: otherWorker }))).status, 402);
    assert.equal(privateReads, reads, "unpaid worker phone was never queried");
    for (status of ["failed", "refunded", "disputed"] as const) assert.equal((await contact(req("/api/workers/contact", { workerId: worker }))).status, 402);
    status = "paid"; mode = "test";
    assert.equal((await contact(req("/api/workers/contact", { workerId: worker }))).status, 402);
    mode = "live"; linkedOwner = other;
    assert.equal((await contact(req("/api/workers/contact", { workerId: worker }))).status, 402);
    workspaceActive = true;
    const workspaceContact = await contact(req("/api/workers/contact", { workerId: otherWorker }));
    assert.equal(workspaceContact.status, 200, "RD$299 remains independent");
    assert.equal(new URL((await workspaceContact.json()).url).searchParams.get("text"), workerContactMessage("Ana"));
    assert.deepEqual(handoffs.at(-1), { order_id: "workspace", product: "workspace", route: "worker" });
  } finally {
    globalThis.fetch = fetchBefore;
    names.forEach((name, i) => { if (before[i] === undefined) delete process.env[name]; else process.env[name] = before[i]; });
  }
});

test("direct checkout rejects missing gates, forged requests, unverified employer, and mismatched price", async () => {
  const names = ["STRIPE_SECRET_KEY", "STRIPE_DIRECT_CONTACT_PRICE_ID", "DIRECT_CONTACT_READ_ENABLED", "DIRECT_CONTACT_CHECKOUT_ENABLED", "DIRECT_CONTACT_LIVE_PAYMENTS_ENABLED", "APP_ORIGIN", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const before = names.map(name => process.env[name]);
  const fetchBefore = globalThis.fetch;
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_DIRECT_CONTACT_PRICE_ID: "price_fixture123",
    DIRECT_CONTACT_READ_ENABLED: "true", DIRECT_CONTACT_CHECKOUT_ENABLED: "true", APP_ORIGIN: "https://preview.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://direct-fixture.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_anon", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const stripe = new Stripe("sk_test_fixture");
  const prices = Object.getPrototypeOf(stripe.prices);
  const sessions = Object.getPrototypeOf(stripe.checkout.sessions);
  const priceBefore = prices.retrieve;
  const createBefore = sessions.create;
  let priceAmount = 8900;
  let created = 0;
  prices.retrieve = async (id: string) => { assert.equal(id, "price_fixture123"); return { id, active: true, type: "one_time", currency: "dop", unit_amount: priceAmount, livemode: false }; };
  sessions.create = async (params: Record<string, unknown>, options: { idempotencyKey: string }) => {
    created++;
    assert.equal(params.mode, "payment");
    assert.deepEqual(params.line_items, [{ price: "price_fixture123", quantity: 1 }]);
    assert.equal(params.client_reference_id, owner);
    assert.deepEqual(params.metadata, { purpose: "employer_direct_contact", order_id: orderId, owner_user_id: owner, worker_id: worker });
    assert.equal(options.idempotencyKey, `direct-contact:${orderId}`);
    assert.match(String(params.success_url), /worker=22222222-2222-4222-8222-222222222222/);
    return { id: "cs_test_direct_fixture", url: "https://checkout.stripe.com/c/pay/cs_test_direct_fixture" };
  };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: owner, email_confirmed_at: "2026-01-01T00:00:00Z" });
    if (url.pathname === "/rest/v1/workers") return Response.json({ id: worker, whatsapp_number: "18095550100" });
    if (url.pathname === "/rest/v1/employer_workspace_orders") return Response.json([]);
    assert.equal(url.pathname, "/rest/v1/employer_direct_contact_orders");
    if (init?.method === "GET") return Response.json(url.searchParams.get("status") === "eq.pending" ? null : []);
    if (init?.method === "POST") return Response.json({ id: orderId });
    if (init?.method === "PATCH") {
      const update = JSON.parse(String(init.body));
      if (update.stripe_session_id) assert.equal(update.browser_session_id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
      return Response.json({ id: orderId });
    }
    throw new Error("Unexpected request");
  };
  const req = (body: unknown, auth = true) => new Request("https://preview.example.test/api/stripe/direct-contact-checkout", { method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer fixture_token_12345678901234567890" } : {}) }, body: JSON.stringify(body) });
  try {
    delete process.env.DIRECT_CONTACT_CHECKOUT_ENABLED;
    assert.equal((await checkout(req({ workerId: worker }))).status, 503);
    process.env.DIRECT_CONTACT_CHECKOUT_ENABLED = "true";
    assert.equal((await checkout(req({ workerId: worker, amount: 1 }))).status, 400);
    assert.equal((await checkout(req({ workerId: worker, browserSessionId: "forged" }))).status, 400);
    assert.equal((await checkout(req({ workerId: "forged" }))).status, 400);
    assert.equal((await checkout(req({ workerId: worker }, false))).status, 401);
    priceAmount = 8901;
    assert.equal((await checkout(req({ workerId: worker }))).status, 503);
    priceAmount = 8900;
    const response = await checkout(req({ workerId: worker, browserSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).sessionId, "cs_test_direct_fixture");
    assert.equal(created, 1);
    process.env.APP_ORIGIN = "https://listordapp.com";
    assert.equal((await checkout(req({ workerId: worker }))).status, 503, "test key cannot open live checkout");
    process.env.STRIPE_SECRET_KEY = "sk_live_fixture";
    process.env.DIRECT_CONTACT_LIVE_PAYMENTS_ENABLED = "true";
    assert.equal(directContactCheckoutReady("https://6acff705--listord-2.netlify.app/api/stripe/direct-contact-checkout"), true,
      "a production function may receive Netlify's deployment host");
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
    assert.equal(directContactCheckoutReady("https://6acff705--listord-2.netlify.app/api/stripe/direct-contact-checkout"), false,
      "a test key cannot use the production return origin");
  } finally {
    prices.retrieve = priceBefore; sessions.create = createBefore; globalThis.fetch = fetchBefore;
    names.forEach((name, i) => { if (before[i] === undefined) delete process.env[name]; else process.env[name] = before[i]; });
  }
});

test("signed direct payment is idempotent and refund or dispute revokes even after out-of-order events", async () => {
  const names = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const before = names.map(name => process.env[name]);
  const fetchBefore = globalThis.fetch;
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "direct_fixture",
    NEXT_PUBLIC_SUPABASE_URL: "https://direct-fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const stripe = new Stripe("sk_test_fixture");
  const sessions = Object.getPrototypeOf(stripe.checkout.sessions);
  const charges = Object.getPrototypeOf(stripe.charges);
  const listBefore = sessions.list;
  const retrieveBefore = charges.retrieve;
  const base = { id: "cs_test_direct_fixture", mode: "payment", payment_status: "paid", amount_total: 8900, currency: "dop",
    payment_intent: "pi_direct_fixture", client_reference_id: owner,
    metadata: { purpose: "employer_direct_contact", order_id: orderId, owner_user_id: owner, worker_id: worker } };
  sessions.list = async () => ({ data: [base] });
  charges.retrieve = async () => ({ payment_intent: "pi_direct_fixture" });
  let status = "pending";
  let intent: string | null = null;
  let writes = 0;
  const reversalKinds: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/rest/v1/employer_payment_reversals") {
      reversalKinds.push(JSON.parse(String(init?.body)).kind);
      return Response.json(null);
    }
    if (url.pathname === "/rest/v1/analytics_events") {
      assert.deepEqual(JSON.parse(String(init?.body)), { event_name: "checkout_success", metadata: { plan: "direct" } });
      return Response.json(null);
    }
    assert.equal(url.pathname, "/rest/v1/employer_direct_contact_orders");
    if (init?.method === "GET") return Response.json({ id: orderId, status, amount: 8900, currency: "dop", stripe_payment_intent_id: intent });
    assert.equal(init?.method, "PATCH");
    const update = JSON.parse(String(init.body));
    if (url.searchParams.get("status") !== `eq.${status}`) return Response.json(null);
    writes++; status = update.status; intent = update.stripe_payment_intent_id ?? intent;
    return Response.json({ id: orderId });
  };
  const deliver = (type: string, object: Record<string, unknown> = {}, eventId = "evt_direct_fixture", livemode = false) => {
    const payload = JSON.stringify({ id: eventId, type, livemode, created: 1_760_000_000, data: { object: { ...base, ...object } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: "direct_fixture" });
    return webhook(new Request("https://example.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body: payload }));
  };
  try {
    assert.equal((await deliver("checkout.session.completed", { amount_total: 8901 })).status, 503);
    assert.equal((await deliver("checkout.session.completed", { client_reference_id: other })).status, 503);
    assert.equal((await deliver("checkout.session.completed", {}, "evt_wrong_mode", true)).status, 503);
    assert.equal((await deliver("checkout.session.completed", { payment_status: "unpaid" })).status, 200);
    assert.equal(writes, 0);
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    assert.equal(status, "paid");
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    assert.equal(writes, 1);
    assert.equal((await deliver("charge.refunded", { payment_intent: "pi_direct_fixture", amount_refunded: 8900 }, "evt_refund_fixture")).status, 200);
    assert.equal(status, "refunded");
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    status = "pending"; intent = null;
    assert.equal((await deliver("charge.dispute.created", { id: "dp_direct_fixture", charge: "ch_direct_fixture", amount: 8900 }, "evt_dispute_fixture")).status, 200);
    assert.equal(status, "disputed");
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    assert.equal(status, "disputed");
    assert.equal((await deliver("charge.dispute.closed", { id: "dp_direct_fixture", charge: "ch_direct_fixture", amount: 8900, status: "won" }, "evt_dispute_won")).status, 200);
    assert.equal((await deliver("charge.dispute.funds_reinstated", { id: "dp_direct_fixture", charge: "ch_direct_fixture", amount: 8900 }, "evt_dispute_reinstated")).status, 200);
    assert.equal(status, "disputed", "dispute resolution never restores a contact entitlement");
    assert.deepEqual(reversalKinds.slice(-3), ["dispute_opened", "dispute_won", "dispute_released"]);
    status = "pending"; intent = null;
    assert.equal((await deliver("checkout.session.expired", { payment_status: "unpaid" })).status, 200);
    assert.equal(status, "failed");
  } finally {
    sessions.list = listBefore; charges.retrieve = retrieveBefore; globalThis.fetch = fetchBefore;
    names.forEach((name, i) => { if (before[i] === undefined) delete process.env[name]; else process.env[name] = before[i]; });
  }
});
