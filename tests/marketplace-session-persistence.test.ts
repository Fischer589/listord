import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET, POST, DELETE } from "../app/api/marketplace-session/route";
import { restoreMarketplaceSession } from "../lib/marketplace-browser";

const actor = "11111111-1111-4111-8111-111111111111";
const access = "fixture_access_token_verified_123456789";
const refresh = "fixture_refresh_token_verified_123456789";
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
