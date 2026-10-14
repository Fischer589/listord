import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET, POST, DELETE } from "../app/api/marketplace-session/route";
import { prepareDirectContactReturn, restoreMarketplaceSession } from "../lib/marketplace-browser";

const actor = "11111111-1111-4111-8111-111111111111";
const access = "fixture_access_token_verified_123456789";
const refresh = "abc123def456"; // Supabase Auth's 12-character refresh-token format.
const endpoint = "https://listord.example/api/marketplace-session";

test("verified employer session survives a new tab, expires, and logout removes the HttpOnly cookie", async () => {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const old = names.map(name => process.env[name]);
  const fetchBefore = globalThis.fetch;
  const nowBefore = Date.now;
  let now = 1_760_000_000_000;
  Date.now = () => now;
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://session-fixture.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_anon", SUPABASE_SERVICE_ROLE_KEY: "fixture_service_role_key_long_enough_for_encryption" });
  let userChecks = 0;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/auth/v1/user");
    userChecks++;
    return Response.json({ id: actor, email_confirmed_at: "2026-01-01T00:00:00Z" });
  };
  const posted = new Request(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://listord.example" },
    body: JSON.stringify({ access_token: access, refresh_token: refresh, expires_at: Math.floor(now / 1000) + 3600 }) });
  try {
    const saved = await POST(posted);
    assert.equal(saved.status, 204);
    const malformedRefresh = await POST(new Request(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: access, refresh_token: "ABC123DEF456", expires_at: Math.floor(now / 1000) + 3600 }) }));
    assert.equal(malformedRefresh.status, 400);
    const setCookie = saved.headers.get("set-cookie")!;
    assert.match(setCookie, /__Host-listord-marketplace-session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=lax/i);
    assert.doesNotMatch(setCookie, new RegExp(access));
    const cookie = setCookie.split(";")[0];
    const restored = await GET(new Request(endpoint, { headers: { Cookie: cookie } }));
    assert.equal(restored.status, 200);
    assert.deepEqual(await restored.json(), { access_token: access, refresh_token: refresh });
    assert.equal(userChecks, 2);

    const browser = { auth: { getSession: async () => ({ data: { session: null } }),
      setSession: async (credentials: { access_token: string; refresh_token: string }) => ({ error: null,
        data: { session: { ...credentials, user: { id: actor } } } }) } } as unknown as SupabaseClient;
    globalThis.fetch = async input => {
      assert.equal(String(input), "/api/marketplace-session");
      return Response.json({ access_token: access, refresh_token: refresh });
    };
    assert.equal((await restoreMarketplaceSession(browser))?.user.id, actor);
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      return Response.json({ id: actor, email_confirmed_at: "2026-01-01T00:00:00Z" });
    };

    now += 31 * 86400_000;
    const expired = await GET(new Request(endpoint, { headers: { Cookie: cookie } }));
    assert.equal(expired.status, 401);
    assert.match(expired.headers.get("set-cookie") ?? "", /Max-Age=0/);
    const logout = await DELETE(new Request(endpoint, { method: "DELETE", headers: { Cookie: cookie, Origin: "https://listord.example", "Content-Type": "application/json" }, body: "{}" }));
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/);
    assert.equal((await GET(new Request(endpoint))).status, 401);
  } finally {
    Date.now = nowBefore;
    globalThis.fetch = fetchBefore;
    names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]; });
  }
});

test("direct checkout uses the existing same-account HttpOnly session and needs no temporary browser storage", async () => {
  const fetchBefore = globalThis.fetch;
  let reads = 0;
  let writes = 0;
  const browser = { auth: {
    getSession: async () => ({ error: null, data: { session: { access_token: access, refresh_token: refresh, user: { id: actor } } } }),
    getUser: async (token: string) => ({ error: null, data: { user: { id: token === access ? actor : "other-account" } } }),
  } } as unknown as SupabaseClient;
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "/api/marketplace-session");
      if (init?.method === "POST") { writes++; return new Response(null, { status: 204 }); }
      reads++;
      return Response.json({ access_token: access, refresh_token: refresh });
    };
    assert.equal(await prepareDirectContactReturn(browser), true);
    assert.equal(reads, 1);
    assert.equal(writes, 0);
  } finally { globalThis.fetch = fetchBefore; }
});

test("direct checkout restores a missing cookie and rejects a mismatched or unavailable session", async () => {
  const fetchBefore = globalThis.fetch;
  let hasCookie = false;
  let saved = 0;
  const browser = { auth: {
    getSession: async () => ({ error: null, data: { session: { access_token: access, refresh_token: refresh, expires_at: 1_800_000_000, user: { id: actor } } } }),
    getUser: async (token: string) => ({ error: null, data: { user: { id: token === access ? actor : "other-account" } } }),
  } } as unknown as SupabaseClient;
  try {
    globalThis.fetch = async (_input, init) => {
      if (init?.method === "POST") { saved++; hasCookie = true; return new Response(null, { status: 204 }); }
      return hasCookie ? Response.json({ access_token: access }) : Response.json({}, { status: 401 });
    };
    assert.equal(await prepareDirectContactReturn(browser), true);
    assert.equal(saved, 1);
    hasCookie = false;
    globalThis.fetch = async (_input, init) => init?.method === "POST"
      ? new Response(null, { status: 204 }) : Response.json({ access_token: "wrong-account-token" });
    assert.equal(await prepareDirectContactReturn(browser), false);
    globalThis.fetch = async () => Response.json({}, { status: 401 });
    assert.equal(await prepareDirectContactReturn(browser), false);
  } finally { globalThis.fetch = fetchBefore; }
});
