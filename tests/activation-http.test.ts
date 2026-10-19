import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { createAdminSession } from "../lib/admin-session";
import { withAdminCookie } from "./request-context";

const owner = "11111111-1111-4111-8111-111111111111";
const worker = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const origin = "https://campaign-fixture.example.test";

test("admin queue audits every profile privately and requires an admin session", async () => {
  const names = ["NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","ADMIN_SESSION_SECRET"] as const;
  const before = names.map(name => process.env[name]);
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: "fixture_service",
    ADMIN_SESSION_SECRET: "campaign-admin-secret" });
  let calls = 0;
  globalThis.fetch = async input => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, origin);
    const table = url.pathname.split("/").at(-1);
    const rows = table === "workers" ? [
      { id: worker, is_verified: true, owner_user_id: owner, whatsapp_number: "8095550100", available_now: false },
      { id: other, is_verified: false, owner_user_id: null, whatsapp_number: null, available_now: false }
    ] : table === "worker_activation_queue" ? [
      { worker_id: worker, invitation_permission_at: null, invitation_channel: null, suppressed_at: null, opted_out_at: null, unreachable_at: null },
      { worker_id: other, invitation_permission_at: null, invitation_channel: null, suppressed_at: null, opted_out_at: null, unreachable_at: null }
    ] : [];
    return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json",
      "content-range": `0-${Math.max(0,rows.length-1)}/${rows.length}` } });
  };
  try {
    const { GET, POST } = await import("../app/api/admin/activation/route");
    await withAdminCookie(undefined, async () => assert.rejects(GET(), /NEXT_REDIRECT/));
    assert.equal(calls, 0);
    const cookie = await createAdminSession("campaign-admin-secret");
    await withAdminCookie(cookie, async () => {
      const response = await GET();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const body = await response.text();
      assert.equal(JSON.parse(body).totals.totalProfiles, 2);
      assert.doesNotMatch(body, /8095550100|whatsapp_number|fixture_service/);
      const invalid = await POST(new Request("https://listord.example/api/admin/activation", { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "permission", workerId: worker, channel: "whatsapp",
          evidenceVerified: false, evidence: "case_12345" }) }));
      assert.equal(invalid.status, 400, "registration never becomes campaign permission");
      const sms = await POST(new Request("https://listord.example/api/admin/activation", { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "permission", workerId: worker, channel: "sms",
          evidenceVerified: true, evidence: "case_12345" }) }));
      assert.equal(sms.status, 400, "activation invitations use WhatsApp only");
    });
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => { if (before[index] === undefined) delete process.env[name]; else process.env[name] = before[index]; });
  }
});

test("worker self-service requires fresh Auth, linked ownership and separate notification choice", async () => {
  const names = ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY"] as const;
  const before = names.map(name => process.env[name]);
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_anon",
    SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/user") return Response.json({ id: owner, email_confirmed_at: "2026-10-01T00:00:00Z" });
    if (url.pathname === "/rest/v1/workers") return Response.json([{ id: worker, is_verified: true }]);
    if (url.pathname === "/rest/v1/worker_availability") return Response.json([]);
    if (url.pathname === "/rest/v1/worker_notification_consent") return Response.json([]);
    if (url.pathname === "/rest/v1/worker_activation_queue") return Response.json([{ worker_id: worker, opted_out_at: null }]);
    if (url.pathname === "/rest/v1/rpc/worker_activation_confirm") {
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body, { p_actor: owner, p_worker: body.p_worker, p_available: true });
      return Response.json(body.p_worker === worker ? [{ available: true, confirmed_at: new Date().toISOString() }] : []);
    }
    if (url.pathname === "/rest/v1/rpc/worker_activation_notification_consent") {
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body, { p_actor: owner, p_worker: worker, p_channel: "whatsapp", p_agree: true });
      return new Response(null, { status: 204 });
    }
    throw new Error("unexpected call");
  };
  try {
    const { GET, POST } = await import("../app/api/workers/activation/route");
    const req = (body?: unknown, authenticated = true) => new Request("https://listord.example/api/workers/activation", {
      method: body ? "POST" : "GET",
      headers: { ...(authenticated ? { authorization: "Bearer " + "x".repeat(40) } : {}),
        ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    assert.equal((await GET(req(undefined, false))).status, 401);
    assert.equal(calls.length, 0);
    const profile = await GET(req());
    assert.equal(profile.status, 200);
    assert.doesNotMatch(await profile.text(), /8095550100|whatsapp_number|fixture_service/);
    assert.equal((await POST(req({ action: "availability", workerId: other, available: true }))).status, 403);
    assert.equal((await POST(req({ action: "availability", workerId: worker, available: true }))).status, 200);
    assert.equal(calls.filter(path => path.includes("notification_consent")).length, 1,
      "availability did not write notification consent");
    assert.equal((await POST(req({ action: "notification_consent", workerId: worker, channel: "whatsapp", agree: true }))).status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => { if (before[index] === undefined) delete process.env[name]; else process.env[name] = before[index]; });
  }
});
