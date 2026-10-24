import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/admin/workers/route";
import { createAdminSession } from "../lib/admin-session";
import { withAdminCookie } from "./request-context";

const workerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const keys = ["ADMIN_SESSION_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

function request(body: unknown) {
  return new Request("https://listord.example/api/admin/workers", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
}

test("pending worker rejection requires admin confirmation and one matched row", async () => {
  const previous = keys.map(key => process.env[key]);
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    ADMIN_SESSION_SECRET: "worker-review-fixture-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://worker-review-fixture.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key"
  });
  const mutations: { url: URL; body: Record<string, unknown> }[] = [];
  let outcome: "success" | "missing" | "failure" | "throw" = "success";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname !== "/rest/v1/workers") throw new Error("Unexpected fixture request");
    assert.equal(init?.method, "PATCH");
    const body = JSON.parse(String(init.body));
    mutations.push({ url, body });
    if (outcome === "throw") throw new Error("network unavailable");
    if (outcome === "failure") return Response.json({ code: "XX000", message: "database failed" }, { status: 500 });
    if (outcome === "missing") return new Response(null, { status: 204 });
    return Response.json({ id: workerId });
  };
  try {
    await withAdminCookie(undefined, async () => {
      await assert.rejects(POST(request({ action: "reject", workerId, confirmId: workerId })), /NEXT_REDIRECT/);
    });
    assert.equal(mutations.length, 0);
    const token = await createAdminSession("worker-review-fixture-secret");
    await withAdminCookie(token, async () => {
      for (const invalid of [
        { action: "reject", workerId, confirmId: otherId },
        { action: "reject", workerId: "bad", confirmId: "bad" },
        { action: "delete", workerId, confirmId: workerId }
      ]) {
        assert.equal((await POST(request(invalid))).status, 400);
      }
      assert.equal(mutations.length, 0);
      const success = await POST(request({ action: "reject", workerId, confirmId: workerId }));
      assert.equal(success.status, 200);
      assert.deepEqual(await success.json(), { saved: true, workerId });
      assert.equal(success.headers.get("cache-control"), "private, no-store");
      assert.equal(mutations.length, 1);
      assert.equal(mutations[0].url.searchParams.get("id"), `eq.${workerId}`);
      assert.equal(mutations[0].url.searchParams.get("is_verified"), "eq.false");
      assert.equal(mutations[0].url.searchParams.get("rejected_at"), "is.null");
      assert.equal(mutations[0].url.searchParams.get("select"), "id");
      assert.equal(typeof mutations[0].body.rejected_at, "string");
      assert.equal(Number.isFinite(Date.parse(String(mutations[0].body.rejected_at))), true);
      for (const [state, expectedStatus] of [["missing", 409], ["failure", 503], ["throw", 503]] as const) {
        outcome = state;
        const response = await POST(request({ action: "reject", workerId, confirmId: workerId }));
        assert.equal(response.status, expectedStatus);
        const body = await response.json();
        assert.equal(body.saved, undefined);
        assert.match(body.error, /registro|rechazar/i);
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});
