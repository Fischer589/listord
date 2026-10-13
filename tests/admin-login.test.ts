import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/admin/session/route";
import { GET as logoutGet, POST as logoutPost } from "../app/admin/logout/route";
import { middleware } from "../middleware";
import { isAdminSession } from "../lib/admin-session";

const origin = "https://listord.example";
const keys = ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"] as const;

function login(username: string, password: string, requestOrigin = origin) {
  return POST(new NextRequest(`${origin}/admin/session`, {
    method: "POST",
    headers: { origin: requestOrigin, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  }));
}

test("admin login issues a guarded session and redirects to dashboard", async () => {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.ADMIN_USERNAME = "owner-fixture";
    process.env.ADMIN_PASSWORD = "password-fixture";
    process.env.ADMIN_SESSION_SECRET = "session-fixture-secret";

    const invalid = await login("owner-fixture", "wrong");
    assert.equal(invalid.status, 303);
    assert.equal(invalid.headers.get("location"), `${origin}/admin/login?error=invalid`);
    assert.equal(invalid.cookies.get("admin_session"), undefined);

    const valid = await login("owner-fixture", "password-fixture");
    assert.equal(valid.status, 303);
    assert.equal(valid.headers.get("location"), `${origin}/admin/dashboard`);
    const cookie = valid.headers.get("set-cookie") ?? "";
    assert.match(cookie, /^admin_session=v1\./);
    assert.ok(!cookie.includes("session-fixture-secret"));
    assert.match(cookie, /httponly/i);
    assert.match(cookie, /samesite=strict/i);
    if (process.env.NODE_ENV === "production") assert.match(cookie, /secure/i);
    assert.equal(await isAdminSession(valid.cookies.get("admin_session")?.value, "session-fixture-secret"), true);
    assert.equal((await middleware(new NextRequest(`${origin}/admin/dashboard`, { headers: { cookie } }))).status, 200);

    const crossOrigin = await login("owner-fixture", "password-fixture", "https://attacker.example");
    assert.equal(crossOrigin.status, 403);
    assert.equal(crossOrigin.headers.get("set-cookie"), null);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test("missing admin configuration fails closed with a distinct error", async () => {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    const response = await login("owner-fixture", "password-fixture");
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), `${origin}/admin/login?error=unavailable`);
    assert.equal(response.cookies.get("admin_session"), undefined);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test("logout only clears a session on a same-origin POST", () => {
  assert.equal(logoutGet().status, 405);
  const request = new NextRequest(`${origin}/admin/logout`, {
    method: "POST",
    headers: { origin, cookie: "admin_session=session-fixture-secret" },
  });
  const response = logoutPost(request);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), `${origin}/admin/login`);
  assert.match(response.headers.get("set-cookie") ?? "", /admin_session=;/);
  const crossOrigin = logoutPost(new NextRequest(`${origin}/admin/logout`, {
    method: "POST",
    headers: { origin: "https://attacker.example" },
  }));
  assert.equal(crossOrigin.status, 403);
});
