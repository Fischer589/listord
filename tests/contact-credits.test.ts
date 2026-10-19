import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";
import { POST as checkout } from "../app/api/stripe/contact-credits-checkout/route";
import { POST as webhook } from "../app/api/stripe/webhook/route";
import { CONTACT_CREDIT_PACKS, contactCreditCheckoutReady } from "../lib/contact-credits";

const owner = "11111111-1111-4111-8111-111111111111";
const worker = "22222222-2222-4222-8222-222222222222";
const second = "33333333-3333-4333-8333-333333333333";
const invalid = "44444444-4444-4444-8444-444444444444";

test("live credit Checkout requires the approved production host and both explicit gates", () => {
  const names = ["STRIPE_SECRET_KEY", "APP_ORIGIN", "CONTACT_CREDITS_CHECKOUT_ENABLED", "CONTACT_CREDITS_LIVE_PAYMENTS_ENABLED"];
  const before = names.map(name => process.env[name]);
  try {
    Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_live_fixture", APP_ORIGIN: "https://listordapp.com",
      CONTACT_CREDITS_CHECKOUT_ENABLED: "true", CONTACT_CREDITS_LIVE_PAYMENTS_ENABLED: "true" });
    assert.equal(contactCreditCheckoutReady("https://preview.netlify.app/api/stripe/contact-credits-checkout"), false);
    assert.equal(contactCreditCheckoutReady("https://listordapp.com/api/stripe/contact-credits-checkout"), true);
    process.env.CONTACT_CREDITS_LIVE_PAYMENTS_ENABLED = "false";
    assert.equal(contactCreditCheckoutReady("https://listordapp.com/api/stripe/contact-credits-checkout"), false);
  } finally { names.forEach((name, index) => { if (before[index] === undefined) delete process.env[name]; else process.env[name] = before[index]; }); }
});

test("credit migration spends atomically, honors old purchases, and revokes reversals", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      insert into auth.users values ('${owner}');
      create table workers(id uuid primary key,full_name text,is_verified boolean,whatsapp_number text);
      insert into workers values ('${worker}','Ana',true,'18095550100'),
        ('${second}','Bea',true,'+18095550101'),('${invalid}','Broken',true,'bad');
      create table employer_workspace_orders(id uuid primary key,owner_user_id uuid,status text,
        stripe_session_id text,paid_at timestamptz,access_until timestamptz);
      create table employer_direct_contact_orders(id uuid primary key,owner_user_id uuid,worker_id uuid,
        status text,stripe_session_id text,paid_at timestamptz);
      create table employer_workspace_contacts(owner_user_id uuid,worker_id uuid,created_at timestamptz);
      create table premium_access(id uuid primary key,status text,paid_access_until timestamptz,
        stripe_checkout_session_id text);
      create table employer_contact_handoffs(product text constraint employer_contact_handoffs_product_check
        check(product in ('direct','workspace')));
      create table employer_payment_reversals(product text constraint employer_payment_reversals_product_check
        check(product in ('direct','workspace')));
      insert into employer_direct_contact_orders values
        ('55555555-5555-4555-8555-555555555555','${owner}','${second}','paid','cs_test_direct',now());`);
    const migration = await readFile(new URL("../supabase/migrations/20261019202538_contact_credit_ledger.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await db.exec(await readFile(new URL("./contact-credit-ledger.sql", import.meta.url), "utf8"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from employer_contact_credit_orders"), /permission denied/);
      await assert.rejects(db.query("select * from authorize_worker_contact($1,$2,'cs_test_',true)", [owner, worker]), /permission denied/);
      await db.exec("reset role");
    }
    const inserted = await db.query<{ id: string }>("insert into employer_contact_credit_orders(owner_user_id,pack_size,amount,stripe_session_id) values($1,5,44500,'cs_test_pack') returning id", [owner]);
    const order = inserted.rows[0].id;
    const settle = (state: string, event: string) => db.query<{ settle_contact_credit_order: string }>(
      "select settle_contact_credit_order($1,$2,'cs_test_pack','pi_pack',$3,44500,'dop',$4)", [order, owner, event, state]);
    assert.equal((await settle("paid", "evt_paid")).rows[0].settle_contact_credit_order, "updated");
    assert.equal((await settle("paid", "evt_paid")).rows[0].settle_contact_credit_order, "duplicate");
    const access = (id: string, prefix = "cs_test_", reveal = true) => db.query<{
      allowed: boolean; source: string; remaining: number; already_unlocked: boolean
    }>("select * from authorize_worker_contact($1,$2,$3,$4)", [owner, id, prefix, reveal]);
    assert.equal((await access(worker, "cs_live_")).rows[0].allowed, false);
    assert.equal((await access(invalid)).rows[0].source, "unavailable");
    assert.equal((await access(worker, "cs_test_", false)).rows[0].remaining, 5);
    assert.equal((await access(worker)).rows[0].remaining, 4);
    assert.equal((await access(worker)).rows[0].already_unlocked, true);
    assert.equal((await access(worker)).rows[0].remaining, 4);
    assert.equal((await access(second)).rows[0].source, "direct");
    assert.equal((await access(second)).rows[0].remaining, 4);
    const overview = await db.query<{ remaining: number; unlocked: Array<{ workerId: string }> }>(
      "select * from contact_credit_overview($1,'cs_test_')", [owner]);
    assert.equal(overview.rows[0].remaining, 4);
    assert.deepEqual(overview.rows[0].unlocked.map(item => item.workerId).sort(), [worker, second].sort());
    assert.equal((await settle("refunded", "evt_refund")).rows[0].settle_contact_credit_order, "updated");
    assert.equal((await access(worker)).rows[0].allowed, false);
    assert.equal((await settle("paid", "evt_replayed_paid")).rows[0].settle_contact_credit_order, "terminal");
    assert.deepEqual((await db.query<{ unlocked: unknown[] }>("select unlocked from contact_credit_overview($1,'cs_test_')", [owner])).rows[0].unlocked,
      [{ workerId: second, name: "Bea" }]);
    await db.query("insert into employer_workspace_orders values('66666666-6666-4666-8666-666666666666',$1,'paid','cs_test_workspace',now()-interval '40 days',now()-interval '10 days')", [owner]);
    await db.query("insert into employer_workspace_contacts values($1,$2,now()-interval '20 days')", [owner, worker]);
    assert.equal((await access(worker)).rows[0].source, "workspace", "logged past workspace contact stays unlocked");
    await db.exec("update employer_workspace_orders set status='refunded'");
    assert.equal((await access(worker)).rows[0].allowed, false);
    await db.exec(`insert into premium_access values
      ('88888888-8888-4888-8888-888888888888','active',now()+interval '1 day','cs_test_legacy')`);
    assert.equal((await access(worker)).rows[0].allowed, false, "browser and phone alone cannot claim an old purchase");
    await db.query("insert into employer_legacy_entitlement_links values($1,$2,'verified-ticket-123',now())",
      ["88888888-8888-4888-8888-888888888888", owner]);
    assert.equal((await access(worker)).rows[0].source, "legacy");
    const linked = await db.query<{ legacy_active: boolean }>("select legacy_active from contact_credit_overview($1,'cs_test_')", [owner]);
    assert.equal(linked.rows[0].legacy_active, true);
    await db.exec("update premium_access set status='canceled'");
    assert.equal((await access(worker)).rows[0].allowed, false);
    const delayed = await db.query<{ id: string }>("insert into employer_contact_credit_orders(owner_user_id,pack_size,amount,stripe_session_id) values($1,1,10000,'cs_test_delayed') returning id", [owner]);
    const delayedId = delayed.rows[0].id;
    const failed = await db.query<{ settle_contact_credit_order: string }>(
      "select settle_contact_credit_order($1,$2,'cs_test_delayed',null,'evt_failed',10000,'dop','failed')", [delayedId, owner]);
    assert.equal(failed.rows[0].settle_contact_credit_order, "updated");
    const eventuallyPaid = await db.query<{ settle_contact_credit_order: string }>(
      "select settle_contact_credit_order($1,$2,'cs_test_delayed','pi_delayed','evt_late_paid',10000,'dop','paid')", [delayedId, owner]);
    assert.equal(eventuallyPaid.rows[0].settle_contact_credit_order, "updated");
    await db.exec("update employer_direct_contact_orders set status='failed'");
    const competing = await Promise.all([access(worker), access(second)]);
    assert.equal(competing.filter(result => result.rows[0].allowed).length, 1,
      "two near-simultaneous new contacts cannot spend one credit twice");
    assert.equal((await db.query<{ credits_remaining: number }>(
      "select credits_remaining from employer_contact_credit_orders where id=$1", [delayedId])).rows[0].credits_remaining, 0);
    const spentWorker = competing[0].rows[0].allowed ? worker : second;
    await db.query("select settle_contact_credit_order($1,$2,'cs_test_delayed','pi_delayed','evt_dispute',10000,'dop','disputed',1760000000)", [delayedId, owner]);
    assert.equal((await access(spentWorker)).rows[0].allowed, false, "an open dispute suspends the contact");
    await db.query("select settle_contact_credit_order($1,$2,'cs_test_delayed','pi_delayed','evt_reinstated',10000,'dop','reinstated',1760000100)", [delayedId, owner]);
    assert.equal((await access(spentWorker)).rows[0].allowed, true, "restored funds restore the purchased contact");
    const staleDispute = await db.query<{ settle_contact_credit_order: string }>(
      "select settle_contact_credit_order($1,$2,'cs_test_delayed','pi_delayed','evt_stale_dispute',10000,'dop','disputed',1760000000)", [delayedId, owner]);
    assert.equal(staleDispute.rows[0].settle_contact_credit_order, "duplicate");
    assert.equal((await access(spentWorker)).rows[0].allowed, true);
  } finally { await db.close(); }
});

test("signed credit webhooks settle paid packs and record refund reversals", async () => {
  const names = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const before = names.map(name => process.env[name]);
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "credit_fixture",
    NEXT_PUBLIC_SUPABASE_URL: "https://credits.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const stripe = new Stripe("sk_test_fixture");
  const sessionPrototype = Object.getPrototypeOf(stripe.checkout.sessions);
  const oldList = sessionPrototype.list;
  const chargePrototype = Object.getPrototypeOf(stripe.charges);
  const oldRetrieve = chargePrototype.retrieve;
  const session = { id: "cs_test_credit_fixture", mode: "payment", payment_status: "paid",
    amount_total: 44500, currency: "dop", payment_intent: "pi_credit_fixture", client_reference_id: owner,
    metadata: { purpose: "employer_contact_credits", order_id: "77777777-7777-4777-8777-777777777777",
      owner_user_id: owner, pack_size: "5" } };
  sessionPrototype.list = async () => ({ data: [session] });
  chargePrototype.retrieve = async () => ({ id: "ch_credit_fixture", payment_intent: "pi_credit_fixture",
    amount: 44500, amount_refunded: 0, currency: "dop" });
  const settled: string[] = [];
  const reversals: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/rest/v1/rpc/settle_contact_credit_order") {
      const body = JSON.parse(String(init?.body));
      settled.push(body.p_state);
      return Response.json("updated");
    }
    if (url.pathname === "/rest/v1/employer_contact_credit_orders") return Response.json({
      id: session.metadata.order_id, amount: 44500, currency: "dop", stripe_payment_intent_id: "pi_credit_fixture"
    });
    if (url.pathname === "/rest/v1/employer_payment_reversals") {
      reversals.push(JSON.parse(String(init?.body)).kind);
      return Response.json(null, { status: 201 });
    }
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
  const deliver = (type: string, object: unknown, secret = "credit_fixture") => {
    const payload = JSON.stringify({ id: `evt_${type.replaceAll(".", "_")}`, type, livemode: false,
      created: 1760000000, data: { object } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    return webhook(new Request("https://example.test/api/stripe/webhook", { method: "POST",
      headers: { "stripe-signature": signature }, body: payload }));
  };
  try {
    assert.equal((await deliver("checkout.session.completed", session, "wrong_secret")).status, 400);
    assert.equal((await deliver("checkout.session.completed", { ...session, amount_total: 8900 })).status, 503);
    assert.equal((await deliver("checkout.session.completed", session)).status, 200);
    const charge = { id: "ch_credit_fixture", payment_intent: "pi_credit_fixture", amount: 44500,
      amount_refunded: 10000, currency: "dop" };
    assert.equal((await deliver("charge.refunded", charge)).status, 200,
      "a partial refund suspends the pack and records the refunded amount");
    assert.equal((await deliver("checkout.session.completed", session)).status, 200,
      "the database prevents a replay from restoring a refunded pack");
    const dispute = { id: "dp_credit_fixture", charge: "ch_credit_fixture", amount: 44500, status: "lost" };
    assert.equal((await deliver("charge.dispute.closed", dispute)).status, 200,
      "a lost dispute revokes credits even when its opening event was missed");
    assert.equal((await deliver("charge.dispute.funds_reinstated", { ...dispute, status: "won" })).status, 200);
    assert.deepEqual(settled, ["paid", "refunded", "paid", "disputed", "reinstated"]);
    assert.deepEqual(reversals, ["refund", "dispute_lost", "dispute_released"]);
  } finally {
    sessionPrototype.list = oldList;
    chargePrototype.retrieve = oldRetrieve;
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => { if (before[index] === undefined) delete process.env[name]; else process.env[name] = before[index]; });
  }
});

test("all three Spanish Checkout packs require verified ownership and exact test prices", async () => {
  const names = ["STRIPE_SECRET_KEY", "APP_ORIGIN", "CONTACT_CREDITS_CHECKOUT_ENABLED",
    "CONTACT_CREDITS_LIVE_PAYMENTS_ENABLED", "STRIPE_CONTACT_CREDIT_1_PRICE_ID",
    "STRIPE_CONTACT_CREDIT_5_PRICE_ID", "STRIPE_CONTACT_CREDIT_10_PRICE_ID",
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const before = names.map(name => process.env[name]);
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_fixture", APP_ORIGIN: "https://preview.example.test",
    CONTACT_CREDITS_CHECKOUT_ENABLED: "true", CONTACT_CREDITS_LIVE_PAYMENTS_ENABLED: "false",
    STRIPE_CONTACT_CREDIT_1_PRICE_ID: "price_one", STRIPE_CONTACT_CREDIT_5_PRICE_ID: "price_five",
    STRIPE_CONTACT_CREDIT_10_PRICE_ID: "price_ten", NEXT_PUBLIC_SUPABASE_URL: "https://credits.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_anon", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const stripe = new Stripe("sk_test_fixture");
  const pricePrototype = Object.getPrototypeOf(stripe.prices);
  const sessionPrototype = Object.getPrototypeOf(stripe.checkout.sessions);
  const oldRetrieve = pricePrototype.retrieve;
  const oldCreate = sessionPrototype.create;
  let amount = 10000;
  let validPrice = true;
  const created: Array<{ locale: string; amount: number }> = [];
  pricePrototype.retrieve = async () => ({ active: validPrice, type: "one_time", currency: "dop", unit_amount: amount, livemode: false });
  sessionPrototype.create = async (input: { locale: string; line_items: Array<{price: string}>; metadata: {pack_size: string} }) => {
    created.push({ locale: input.locale, amount: CONTACT_CREDIT_PACKS[Number(input.metadata.pack_size) as 1 | 5 | 10].amount });
    return { id: `cs_test_credit_${created.length}`, url: "https://checkout.stripe.com/c/pay_fixture" };
  };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: owner, email_confirmed_at: "2026-01-01T00:00:00Z" });
    if (url.pathname === "/rest/v1/employer_contact_credit_orders") {
      if (init?.method === "GET") return Response.json(null);
      if (init?.method === "POST") return Response.json({ id: "77777777-7777-4777-8777-777777777777" });
      if (init?.method === "PATCH") return Response.json({ id: "77777777-7777-4777-8777-777777777777" });
    }
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
  const request = (pack: number, authorized = true, host = "preview.example.test") => new Request(
    `https://${host}/api/stripe/contact-credits-checkout`, { method: "POST", headers: {
      "Content-Type": "application/json", ...(authorized ? { Authorization: "Bearer fixture_token_12345678901234567890" } : {}) },
      body: JSON.stringify({ pack }) });
  try {
    assert.equal((await checkout(request(1, false))).status, 401);
    for (const pack of [1, 5, 10]) {
      amount = CONTACT_CREDIT_PACKS[pack as 1 | 5 | 10].amount;
      assert.equal((await checkout(request(pack))).status, 200);
    }
    assert.deepEqual(created, [{ locale: "es", amount: 10000 }, { locale: "es", amount: 44500 }, { locale: "es", amount: 89000 }]);
    amount = 8900;
    assert.equal((await checkout(request(1))).status, 503, "old RD$89 price cannot replace RD$100");
    assert.equal((await checkout(request(1, true, "listordapp.com"))).status, 503, "test mode cannot sell on production");
    validPrice = false;
    assert.equal((await checkout(request(5))).status, 503);
  } finally {
    pricePrototype.retrieve = oldRetrieve;
    sessionPrototype.create = oldCreate;
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => { if (before[index] === undefined) delete process.env[name]; else process.env[name] = before[index]; });
  }
});
