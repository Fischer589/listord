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

test("pending worker deletion requires admin confirmation and reports transaction outcomes", async () => {
  const previous = keys.map(key => process.env[key]);
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    ADMIN_SESSION_SECRET: "worker-review-fixture-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://worker-review-fixture.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key"
  });
  const mutations: { url: URL; body: Record<string, unknown> }[] = [];
  let outcome: "success" | "missing" | "protected" | "failure" | "foreign_key" | "unexpected" | "throw" = "success";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname !== "/rest/v1/rpc/admin_delete_pending_worker") throw new Error("Unexpected fixture request");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init.body));
    mutations.push({ url, body });
    if (outcome === "throw") throw new Error("network unavailable");
    if (outcome === "failure") return Response.json({ code: "XX000", message: "database failed" }, { status: 500 });
    if (outcome === "foreign_key") return Response.json({ code: "23503", message: "protected child" }, { status: 409 });
    return Response.json(outcome === "missing" ? "not_pending" : outcome === "protected" ? "protected" : outcome === "unexpected" ? null : "deleted");
  };
  try {
    await withAdminCookie(undefined, async () => {
      await assert.rejects(POST(request({ action: "delete", workerId, confirmId: workerId })), /NEXT_REDIRECT/);
    });
    assert.equal(mutations.length, 0);
    const token = await createAdminSession("worker-review-fixture-secret");
    await withAdminCookie(token, async () => {
      for (const invalid of [
        { action: "delete", workerId, confirmId: otherId },
        { action: "delete", workerId: "bad", confirmId: "bad" },
        { action: "reject", workerId, confirmId: workerId }
      ]) {
        assert.equal((await POST(request(invalid))).status, 400);
      }
      assert.equal(mutations.length, 0);
      const success = await POST(request({ action: "delete", workerId, confirmId: workerId }));
      assert.equal(success.status, 200);
      assert.deepEqual(await success.json(), { deleted: true, workerId });
      assert.equal(success.headers.get("cache-control"), "private, no-store");
      assert.equal(mutations.length, 1);
      assert.deepEqual(mutations[0].body, { p_worker_id: workerId });
      for (const [state, expectedStatus] of [["missing", 409], ["protected", 409], ["foreign_key", 409], ["failure", 503], ["unexpected", 503], ["throw", 503]] as const) {
        outcome = state;
        const response = await POST(request({ action: "delete", workerId, confirmId: workerId }));
        assert.equal(response.status, expectedStatus);
        const body = await response.json();
        assert.equal(body.deleted, undefined);
        assert.match(body.error, /registro|eliminar|historial/i);
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
