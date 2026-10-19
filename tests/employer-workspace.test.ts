import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";
import { POST as webhook } from "../app/api/stripe/webhook/route";
import { POST as checkout } from "../app/api/stripe/workspace-checkout/route";
import { GET as workspaceGet, POST as workspacePost } from "../app/api/employer-workspace/route";
import { WORKSPACE_AMOUNT_CENTS, workspaceAccessUntil, workspaceSessionPattern } from "../lib/employer-workspace";

const owner = "11111111-1111-4111-8111-111111111111";
const worker = "22222222-2222-4222-8222-222222222222";
const orderId = "33333333-3333-4333-8333-333333333333";

test("workspace migration is additive, leaves worker data intact, and keeps private tables inaccessible", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.workers(id uuid primary key, full_name text, is_verified boolean);
      insert into auth.users values('${owner}');
      insert into public.workers values('${worker}', 'Preserved Worker', true);`);
    const migration = await readFile(new URL("../supabase/migrations/202610111900_employer_workspace.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await db.exec(await readFile(new URL("../supabase/migrations/202610131500_workspace_exact_period.sql", import.meta.url), "utf8"));
    assert.deepEqual((await db.query<{full_name:string}>("select full_name from public.workers")).rows, [{ full_name: "Preserved Worker" }]);
    await db.query("insert into public.employer_workspace_orders(owner_user_id) values($1)", [owner]);
    await db.exec("set time zone 'America/New_York'");
    await assert.rejects(db.query(`update public.employer_workspace_orders set status='paid', paid_at='2026-10-14T00:00:00Z',
      access_until='2026-11-14T00:00:00Z' where owner_user_id=$1`, [owner]), /employer_workspace_exact_30d/);
    await db.query(`update public.employer_workspace_orders set status='paid', paid_at='2026-10-14T00:00:00Z',
      access_until='2026-11-13T00:00:00Z' where owner_user_id=$1`, [owner]);
    await db.query("insert into public.employer_workspace_candidates(owner_user_id,worker_id) values($1,$2)", [owner, worker]);
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from public.employer_workspace_orders"), /permission denied/);
    await assert.rejects(db.query("select * from public.employer_workspace_candidates"), /permission denied/);
    await db.exec("reset role; set role service_role");
    assert.equal((await db.query("select id from public.employer_workspace_orders")).rows.length, 1);
  } finally { await db.close(); }
});

test("workspace session mode filter treats underscores literally", async () => {
  const db = new PGlite();
  try {
    const result = await db.query<{ valid: boolean; test: boolean; lookalike: boolean }>(
      "select 'cs_live_valid' like $1 as valid, 'cs_test_invalid' like $1 as test, 'csXliveXinvalid' like $1 as lookalike",
      [workspaceSessionPattern("cs_live_")]);
    assert.deepEqual(result.rows, [{ valid: true, test: false, lookalike: false }]);
  } finally { await db.close(); }
});

test("retired workspace checkout cannot create a new unlimited pass", async () => {
  assert.equal((await checkout(new Request("https://listordapp.com/api/stripe/workspace-checkout", { method: "POST" }))).status, 410);
});

test("signed workspace events grant exactly once after a confirmed ledger update; unpaid and mismatched events do not grant", async () => {
  const names = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const old = names.map(name => process.env[name]);
  const oldFetch = globalThis.fetch;
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "workspace_fixture", NEXT_PUBLIC_SUPABASE_URL: "https://workspace-fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const stripe = new Stripe("sk_test_fixture");
  const sessionsPrototype = Object.getPrototypeOf(stripe.checkout.sessions);
  const originalList = sessionsPrototype.list;
  const chargesPrototype = Object.getPrototypeOf(stripe.charges);
  const originalChargeRetrieve = chargesPrototype.retrieve;
  chargesPrototype.retrieve = async () => ({ payment_intent: "pi_workspace_fixture" });
  let status = "pending";
  let paymentIntent: string | null = null;
  let updates = 0;
  let acknowledge = true;
  const reversalKinds: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/rest/v1/employer_payment_reversals") {
      reversalKinds.push(JSON.parse(String(init?.body)).kind);
      return Response.json(null);
    }
    assert.equal(url.pathname, "/rest/v1/employer_workspace_orders");
    if (init?.method === "GET") {
      if (url.searchParams.has("stripe_session_id")) return Response.json({ id: orderId, owner_user_id: owner,
        status, amount: WORKSPACE_AMOUNT_CENTS, currency: "dop", stripe_session_id: "cs_test_workspace_fixture", stripe_payment_intent_id: paymentIntent });
      return Response.json({ id: orderId, amount: WORKSPACE_AMOUNT_CENTS, status, stripe_payment_intent_id: paymentIntent });
    }
    assert.equal(init?.method, "PATCH");
    const body = JSON.parse(String(init.body));
    if (body.status === "paid") {
      updates++;
      assert.equal(url.searchParams.get("status"), `eq.${status}`);
      assert.equal(body.access_until, workspaceAccessUntil(new Date(1_760_000_000_000)));
      if (!acknowledge) return Response.json(null);
      status = "paid"; paymentIntent = "pi_workspace_fixture";
      return Response.json({ id: orderId });
    }
    if (url.searchParams.get("status") !== `eq.${status}`) return Response.json(null);
    status = body.status;
    paymentIntent = body.stripe_payment_intent_id ?? paymentIntent;
    return Response.json({ id: orderId, amount: WORKSPACE_AMOUNT_CENTS });
  };
  const baseSession = { id: "cs_test_workspace_fixture", mode: "payment", payment_status: "paid", amount_total: WORKSPACE_AMOUNT_CENTS,
    currency: "dop", payment_intent: "pi_workspace_fixture", client_reference_id: owner,
    metadata: { purpose: "employer_workspace_30d", order_id: orderId, owner_user_id: owner } };
  sessionsPrototype.list = async (params: { payment_intent: string }) => {
    assert.equal(params.payment_intent, "pi_workspace_fixture");
    return { data: [baseSession] };
  };
  async function deliver(type: string, changes: Record<string, unknown> = {}, secret = "workspace_fixture") {
    const payload = JSON.stringify({ id: `evt_${type.replaceAll(".", "_")}`, type, created: 1_760_000_000,
      data: { object: { ...baseSession, ...changes } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    return webhook(new Request("https://example.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body: payload }));
  }
  try {
    assert.equal((await deliver("checkout.session.completed", {}, "wrong_secret")).status, 400);
    assert.equal((await deliver("checkout.session.completed", { id: "cs_live_wrong_mode" })).status, 503);
    assert.equal((await deliver("checkout.session.completed", { payment_status: "unpaid" })).status, 200);
    assert.equal((await deliver("checkout.session.completed", { amount_total: WORKSPACE_AMOUNT_CENTS + 1 })).status, 503);
    assert.equal((await deliver("checkout.session.completed", { client_reference_id: "another-owner" })).status, 503);
    assert.equal(updates, 0);
    assert.equal((await deliver("checkout.session.async_payment_failed", { payment_status: "unpaid" })).status, 200);
    assert.equal(status, "failed");
    assert.equal(updates, 0);
    acknowledge = false;
    assert.equal((await deliver("checkout.session.completed")).status, 503);
    assert.equal(updates, 1);
    acknowledge = true;
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    assert.equal(status, "paid");
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    assert.equal(updates, 2);
    assert.equal((await deliver("checkout.session.async_payment_succeeded")).status, 200);
    assert.equal(updates, 2);
    assert.equal((await deliver("charge.refunded", { payment_intent: "pi_workspace_fixture", amount_refunded: WORKSPACE_AMOUNT_CENTS })).status, 200);
    assert.equal(status, "refunded");
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    assert.equal(status, "refunded");
    assert.equal(updates, 2);
    status = "pending"; paymentIntent = null;
    assert.equal((await deliver("charge.refunded", { payment_intent: "pi_workspace_fixture", amount_refunded: WORKSPACE_AMOUNT_CENTS })).status, 200);
    assert.equal(status, "refunded");
    assert.equal((await deliver("checkout.session.completed")).status, 200);
    assert.equal(status, "refunded");
    assert.equal(updates, 2);
    status = "paid"; paymentIntent = "pi_workspace_fixture";
    assert.equal((await deliver("charge.dispute.created", { id: "dp_workspace_fixture", charge: "ch_workspace_fixture", amount: WORKSPACE_AMOUNT_CENTS })).status, 200);
    assert.equal(status, "refunded", "a Workspace dispute revokes contact entitlement");
    assert.equal((await deliver("charge.dispute.closed", { id: "dp_workspace_fixture", charge: "ch_workspace_fixture", amount: WORKSPACE_AMOUNT_CENTS, status: "won" })).status, 200);
    assert.equal((await deliver("charge.dispute.funds_reinstated", { id: "dp_workspace_fixture", charge: "ch_workspace_fixture", amount: WORKSPACE_AMOUNT_CENTS })).status, 200);
    assert.equal(status, "refunded", "dispute resolution never restores Workspace access");
    assert.deepEqual(reversalKinds.slice(-3), ["dispute_opened", "dispute_won", "dispute_released"]);
  } finally {
    sessionsPrototype.list = originalList;
    chargesPrototype.retrieve = originalChargeRetrieve;
    globalThis.fetch = oldFetch;
    names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]; });
  }
});

test("workspace API requires a verified employer and a current paid order before any private write", async () => {
  const names = ["EMPLOYER_WORKSPACE_ENABLED", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const old = names.map(name => process.env[name]);
  const oldFetch = globalThis.fetch;
  Object.assign(process.env, { EMPLOYER_WORKSPACE_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_fixture", NEXT_PUBLIC_SUPABASE_URL: "https://workspace-fixture.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_anon", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  let active = false;
  let writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: owner, email: "employer@example.test",
      email_confirmed_at: "2026-01-01T00:00:00Z", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
    if (url.pathname !== "/rest/v1/employer_workspace_orders") return Response.json({ code: "42P01", message: "missing table" }, { status: 404 });
    if (init?.method !== "GET") writes++;
    return Response.json(active ? [{ access_until: "2099-01-01T00:00:00Z" }] : []);
  };
  const endpoint = "https://example.test/api/employer-workspace";
  const request = (auth: boolean) => new Request(endpoint, { method: "POST", headers: {
    "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer fixture_token_12345678901234567890" } : {}) },
    body: JSON.stringify({ action: "save_candidate", workerId: worker }) });
  try {
    assert.equal((await workspaceGet(new Request(endpoint))).status, 401);
    assert.equal((await workspacePost(request(false))).status, 401);
    assert.equal((await workspacePost(request(true))).status, 403);
    assert.equal(writes, 0);
    active = true;
    const response = await workspaceGet(new Request(endpoint, { headers: { Authorization: "Bearer fixture_token_12345678901234567890" } }));
    assert.equal(response.status, 503); // Missing private tables must fail closed, never fabricate an empty workspace.
  } finally {
    globalThis.fetch = oldFetch;
    names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]; });
  }
});

test("paid contact tracking stores a private handoff with the selected worker and staffing request context", async () => {
  const names = ["EMPLOYER_WORKSPACE_ENABLED", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const old = names.map(name => process.env[name]);
  const oldFetch = globalThis.fetch;
  Object.assign(process.env, { EMPLOYER_WORKSPACE_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_fixture", NEXT_PUBLIC_SUPABASE_URL: "https://workspace-fixture.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_anon", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  let inserted: Record<string, unknown> | null = null;
  let funnelHandoff: Record<string, unknown> | null = null;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: owner, email_confirmed_at: "2026-01-01T00:00:00Z", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
    if (url.pathname === "/rest/v1/rpc/authorize_worker_contact") return Response.json([{ allowed: true, source: "workspace", source_order: orderId, remaining: 0, already_unlocked: true }]);
    if (url.pathname === "/rest/v1/employer_workspace_orders") {
      assert.match(url.searchParams.get("access_until") ?? "", /^gt\./);
      assert.equal(url.searchParams.get("stripe_session_id"), "like.cs\\_test\\_%");
      return Response.json([{ id: orderId, access_until: "2099-01-01T00:00:00Z" }]);
    }
    if (url.pathname === "/rest/v1/workers") {
      assert.equal(url.searchParams.get("id"), `eq.${worker}`);
      assert.equal(url.searchParams.get("is_verified"), "eq.true");
      return Response.json({ id: worker, full_name: "Verified Worker", whatsapp_number: "18090000000" });
    }
    if (url.pathname === "/rest/v1/employer_workspace_requests") {
      assert.equal(url.searchParams.get("owner_user_id"), `eq.${owner}`);
      return Response.json({ title: "Limpieza semanal" });
    }
    if (url.pathname === "/rest/v1/employer_contact_handoffs") {
      funnelHandoff = JSON.parse(String(init?.body));
      return Response.json(null);
    }
    assert.equal(url.pathname, "/rest/v1/employer_workspace_contacts");
    assert.equal(init?.method, "POST");
    inserted = JSON.parse(String(init.body));
    return Response.json({ id: "44444444-4444-4444-8444-444444444444" });
  };
  try {
    const response = await workspacePost(new Request("https://example.test/api/employer-workspace", { method: "POST", headers: {
      Authorization: "Bearer fixture_token_12345678901234567890", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prepare_contact", workerId: worker, requestId: orderId }) }));
    assert.equal(response.status, 200);
    assert.deepEqual(inserted, { owner_user_id: owner, worker_id: worker, request_id: orderId });
    assert.deepEqual(funnelHandoff, { order_id: orderId, product: "workspace", route: "workspace" });
    const url = new URL((await response.json()).url);
    assert.equal(url.hostname, "wa.me");
    assert.equal(url.searchParams.get("text"), "¡Hola! 👋 Encontré tu perfil en ListoRD y me gustaría conversar contigo sobre una oportunidad de trabajo. ¿Tienes disponibilidad para que hablemos de los detalles?");
  } finally {
    globalThis.fetch = oldFetch;
    names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]; });
  }
});

test("retired workspace checkout remains closed with a verified account", async () => {
  assert.equal((await checkout(new Request("https://example.test/api/stripe/workspace-checkout", { method: "POST" }))).status, 410);
});
