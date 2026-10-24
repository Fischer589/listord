import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../app/api/admin/marketplace/route";
import { createAdminSession } from "../lib/admin-session";
import { withAdminCookie } from "./request-context";
import Stripe from "stripe";

const id = "22222222-2222-4222-8222-222222222222";
const keys = ["ADMIN_SESSION_SECRET", "MARKETPLACE_ENABLED", "FEATURED_OPPORTUNITIES_ENABLED", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
test("admin opportunity review is private, counted by status, and requires privacy review before approval", async () => {
  const previous = keys.map(key => process.env[key]);
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { ADMIN_SESSION_SECRET: "moderation-fixture-secret", MARKETPLACE_ENABLED: "true", FEATURED_OPPORTUNITIES_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://marketplace-fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture-service" });
  const queries: URL[] = [];
  const mutations: unknown[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/marketplace_opportunities")) {
      queries.push(url);
      assert.doesNotMatch(url.searchParams.get("select") ?? "", /contact_name|whatsapp_number|owner_user_id/);
      const status = url.searchParams.get("moderation_status");
      const count = status === "eq.pending" ? 3 : status === "eq.approved" ? 8 : 2;
      return new Response(JSON.stringify([{ id, category: "limpieza", city: "Santiago", scope: "Limpieza general", specification: {}, created_at: "2026-10-13T00:00:00Z", expires_at: "2026-11-13T00:00:00Z", status: status === "eq.pending" ? "draft" : "open", moderation_status: status?.slice(3) }]), { headers: { "content-type": "application/json", "content-range": "0-0/" + count } });
    }
    if (url.pathname.endsWith("/marketplace_reports")) return Response.json([]);
    if (url.pathname.endsWith("/marketplace_featured_orders") && url.searchParams.get("status") === "eq.pending") return Response.json([]);
    if (url.pathname.endsWith("/marketplace_featured_orders")) return Response.json([
      { id: "33333333-3333-4333-8333-333333333333", opportunity_id: id, paid_at: "2026-10-13T00:00:00Z", featured_until: "2099-10-20T00:00:00Z", marketplace_opportunities: { status: "closed", moderation_status: "approved", expires_at: "2099-10-22T00:00:00Z" } },
      { id: "44444444-4444-4444-8444-444444444444", opportunity_id: id, paid_at: "2026-10-13T00:00:00Z", featured_until: "2099-10-20T00:00:00Z", marketplace_opportunities: { status: "open", moderation_status: "approved", expires_at: "2099-10-22T00:00:00Z" } }
    ]);
    if (url.pathname.endsWith("/rpc/marketplace_moderate")) {
      mutations.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    if (url.pathname.endsWith("/rpc/marketplace_soft_delete")) {
      mutations.push(JSON.parse(String(init?.body)));
      return Response.json(true);
    }
    throw new Error("Unexpected fixture request");
  };
  const body = (value: unknown) => new Request("https://listord.example/api/admin/marketplace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
  try {
    await withAdminCookie(undefined, async () => {
      await assert.rejects(GET(), /NEXT_REDIRECT/);
      await assert.rejects(POST(body({ id, approve: true, privacyReviewed: true })), /NEXT_REDIRECT/);
      await assert.rejects(POST(body({ action: "delete", id, confirmId: id })), /NEXT_REDIRECT/);
    });
    const token = await createAdminSession("moderation-fixture-secret");
    await withAdminCookie(token, async () => {
      const response = await GET();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const data = await response.json();
      assert.deepEqual(data.counts, { pending: 3, approved: 8, rejected: 2 });
      assert.equal(data.opportunities.length, 3);
      assert.deepEqual(data.earlyClosures.map((order: {id: string}) => order.id), ["33333333-3333-4333-8333-333333333333"]);
      assert.equal(queries.length, 3);
      assert.equal(queries[0].searchParams.get("status"), "eq.draft");
      assert.equal(queries.every(query => query.searchParams.get("deleted_at") === "is.null"), true);
      assert.equal((await POST(body({ id, approve: true }))).status, 400);
      assert.equal(mutations.length, 0);
      assert.equal((await POST(body({ id, approve: true, privacyReviewed: true }))).status, 200);
      assert.equal((await POST(body({ id, approve: false }))).status, 200);
      assert.equal((await POST(body({ action: "delete", id, confirmId: "33333333-3333-4333-8333-333333333333" }))).status, 400);
      assert.equal((await POST(body({ action: "delete", id, confirmId: id }))).status, 200);
      assert.deepEqual(mutations, [{ p_id: id, p_approve: true }, { p_id: id, p_approve: false }, { p_id: id }]);
    });
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});

test("admin deletion reports missing, repeated, and failed database results without claiming success", async () => {
  const previous = keys.map(key => process.env[key]);
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { ADMIN_SESSION_SECRET: "moderation-fixture-secret", MARKETPLACE_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://marketplace-fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture-service" });
  let result: "missing" | "repeated" | "empty" | "failure" = "missing";
  const mutations: unknown[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/marketplace_featured_orders")) return Response.json([]);
    if (url.pathname.endsWith("/rpc/marketplace_soft_delete")) {
      mutations.push(JSON.parse(String(init?.body)));
      if (result === "missing") return Response.json({ code: "P0001", message: "NOT_FOUND" }, { status: 400 });
      if (result === "repeated") return Response.json(false);
      if (result === "empty") return new Response(null, { status: 204 });
      return Response.json({ code: "XX000", message: "database failure" }, { status: 500 });
    }
    throw new Error("Unexpected fixture request");
  };
  const request = () => new Request("https://listord.example/api/admin/marketplace", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id, confirmId: id }) });
  try {
    const token = await createAdminSession("moderation-fixture-secret");
    await withAdminCookie(undefined, async () => { await assert.rejects(POST(request()), /NEXT_REDIRECT/); });
    assert.equal(mutations.length, 0);
    await withAdminCookie(token, async () => {
      for (const [scenario, status] of [["missing", 404], ["repeated", 409], ["empty", 503], ["failure", 503]] as const) {
        result = scenario;
        const response = await POST(request());
        assert.equal(response.status, status);
        assert.equal((await response.json()).saved, undefined);
      }
    });
    assert.deepEqual(mutations, [{ p_id: id }, { p_id: id }, { p_id: id }, { p_id: id }]);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});

test("admin deletion expires a bound unpaid Checkout before soft deletion and stops on a completed payment", async () => {
  const previous = keys.map(key => process.env[key]);
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { ADMIN_SESSION_SECRET: "moderation-fixture-secret", MARKETPLACE_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://marketplace-fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", STRIPE_SECRET_KEY: "sk_test_fixture" });
  const stripe = new Stripe("sk_test_fixture");
  const sessions = Object.getPrototypeOf(stripe.checkout.sessions);
  const oldRetrieve = sessions.retrieve;
  const oldExpire = sessions.expire;
  let state: "open" | "complete" = "open";
  let expired = 0;
  const calls: string[] = [];
  sessions.retrieve = async () => ({ id: "cs_test_pending", status: state });
  sessions.expire = async () => { expired++; return { id: "cs_test_pending", status: "expired" }; };
  globalThis.fetch = async input => {
    const pathname = new URL(String(input)).pathname;
    if (pathname.endsWith("/marketplace_featured_orders")) return Response.json([{ id: "33333333-3333-4333-8333-333333333333", stripe_session_id: "cs_test_pending" }]);
    if (pathname.endsWith("/rpc/marketplace_featured_fail")) { calls.push("fail"); return Response.json(null); }
    if (pathname.endsWith("/rpc/marketplace_soft_delete")) { calls.push("delete"); return Response.json(true); }
    throw new Error("Unexpected query");
  };
  const request = () => new Request("https://listord.example/api/admin/marketplace", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id, confirmId: id }) });
  try {
    const token = await createAdminSession("moderation-fixture-secret");
    await withAdminCookie(token, async () => {
      assert.equal((await POST(request())).status, 200);
      assert.equal(expired, 1);
      assert.deepEqual(calls, ["fail", "delete"]);
      calls.length = 0;
      state = "complete";
      assert.equal((await POST(request())).status, 409);
      assert.deepEqual(calls, []);
    });
  } finally {
    sessions.retrieve = oldRetrieve; sessions.expire = oldExpire; globalThis.fetch = originalFetch;
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
    if (stripeKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = stripeKey;
  }
});
