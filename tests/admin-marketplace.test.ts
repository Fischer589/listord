import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../app/api/admin/marketplace/route";
import { createAdminSession } from "../lib/admin-session";
import { withAdminCookie } from "./request-context";

const id = "22222222-2222-4222-8222-222222222222";
const keys = ["ADMIN_SESSION_SECRET", "MARKETPLACE_ENABLED", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
test("admin opportunity review is private, counted by status, and requires privacy review before approval", async () => {
  const previous = keys.map(key => process.env[key]);
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { ADMIN_SESSION_SECRET: "moderation-fixture-secret", MARKETPLACE_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://marketplace-fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture-service" });
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
    if (url.pathname.endsWith("/rpc/marketplace_moderate")) {
      mutations.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected fixture request");
  };
  const body = (value: unknown) => new Request("https://listord.example/api/admin/marketplace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
  try {
    await withAdminCookie(undefined, async () => {
      await assert.rejects(GET(), /NEXT_REDIRECT/);
      await assert.rejects(POST(body({ id, approve: true, privacyReviewed: true })), /NEXT_REDIRECT/);
    });
    const token = await createAdminSession("moderation-fixture-secret");
    await withAdminCookie(token, async () => {
      const response = await GET();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const data = await response.json();
      assert.deepEqual(data.counts, { pending: 3, approved: 8, rejected: 2 });
      assert.equal(data.opportunities.length, 3);
      assert.equal(queries.length, 3);
      assert.equal(queries[0].searchParams.get("status"), "eq.draft");
      assert.equal((await POST(body({ id, approve: true }))).status, 400);
      assert.equal(mutations.length, 0);
      assert.equal((await POST(body({ id, approve: true, privacyReviewed: true }))).status, 200);
      assert.equal((await POST(body({ id, approve: false }))).status, 200);
      assert.deepEqual(mutations, [{ p_id: id, p_approve: true }, { p_id: id, p_approve: false }]);
    });
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});
