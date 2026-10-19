import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { withAdminCookie } from "./request-context";
import { createAdminSession } from "../lib/admin-session";
import { POST, GET } from "../app/api/admin/marketplace/route";

const worker = "22222222-2222-4222-8222-222222222222";
const owner = "11111111-1111-4111-8111-111111111111";

test("owner recovery stays admin-verified while the marketplace and outreach remain closed", async () => {
  const envKeys = ["ADMIN_SESSION_SECRET", "MARKETPLACE_ENABLED", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const before = envKeys.map(key => process.env[key]);
  const oldFetch = globalThis.fetch;
  Object.assign(process.env, { ADMIN_SESSION_SECRET: "activation-admin-secret", MARKETPLACE_ENABLED: "false",
    NEXT_PUBLIC_SUPABASE_URL: "https://owner-fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  let confirmed = false;
  let writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://owner-fixture.example.test");
    if (url.pathname.includes("/auth/v1/admin/users/")) return Response.json({ id: owner,
      email_confirmed_at: confirmed ? "2026-10-18T00:00:00Z" : null, is_anonymous: false });
    if (url.pathname.endsWith("/rpc/marketplace_link_owner")) {
      writes++;
      assert.deepEqual(JSON.parse(String(init?.body)), { p_worker: worker, p_owner: owner,
        p_evidence: "case_2026_001", p_operator: "operator_one" });
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected operation");
  };
  const request = (changes: Record<string, unknown> = {}) => new Request("https://listord.example/api/admin/marketplace", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: "link_owner", id: worker, owner, evidence: "case_2026_001", operator: "operator_one",
      identityVerified: true, ...changes
    })
  });
  try {
    await withAdminCookie(undefined, async () => assert.rejects(POST(request()), /NEXT_REDIRECT/));
    const adminToken = await createAdminSession("activation-admin-secret");
    await withAdminCookie(adminToken, async () => {
      assert.equal((await GET()).status, 503, "marketplace inventory stays closed");
      assert.equal((await POST(request({ action: "delete" }))).status, 503);
      assert.equal((await POST(request({ identityVerified: false }))).status, 400);
      assert.equal((await POST(request({ evidence: "bad evidence" }))).status, 400);
      assert.equal((await POST(request())).status, 409, "an unconfirmed Auth account cannot be linked");
      assert.equal(writes, 0);
      confirmed = true;
      assert.equal((await POST(request())).status, 200);
      assert.equal(writes, 1, "only the existing audited owner-link RPC writes");
    });
  } finally {
    globalThis.fetch = oldFetch;
    envKeys.forEach((key, i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i]; });
  }
});
