// Match Next's server bootstrap before importing request-scoped APIs.
import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { createAdminSession, isAdminSession } from "../lib/admin-session";
import { requireAdmin } from "../lib/admin-auth";
import { withAdminCookie } from "./request-context";

test("admin sessions fail closed for missing, wrong, tampered and expired credentials", async () => {
  assert.equal(await isAdminSession(undefined, undefined), false);
  assert.equal(await isAdminSession("", ""), false);
  assert.equal(await isAdminSession("secret", "secret"), false);
  const token = await createAdminSession("test-only-secret");
  assert.equal(await isAdminSession(token, "test-only-secret"), true);
  assert.equal(await isAdminSession(token, "other-secret"), false);
  const parts = token.split(".");
  parts[3] = `${parts[3][0] === "x" ? "y" : "x"}${parts[3].slice(1)}`;
  assert.equal(await isAdminSession(parts.join("."), "test-only-secret"), false);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const signature = token.split(".")[3];
  const last = signature.at(-1)!;
  const alternate = `${signature.slice(0, -1)}${alphabet[alphabet.indexOf(last) ^ 1]}`;
  assert.equal(await isAdminSession(`${token.slice(0, -signature.length)}${alternate}`, "test-only-secret"), false);
  const expired = token.replace(/^v1\.\d+\./, "v1.1000000000.");
  assert.equal(await isAdminSession(expired, "test-only-secret"), false);
});

test("middleware denies admin even when the legacy bypass flag is false", async () => {
  const before = process.env.ADMIN_SESSION_SECRET;
  const flag = process.env.ADMIN_AUTH_ENABLED;
  try {
    process.env.ADMIN_AUTH_ENABLED = "false";
    delete process.env.ADMIN_SESSION_SECRET;
    assert.equal((await middleware(new NextRequest("https://listord.example/admin/workers"))).status, 307);
    process.env.ADMIN_SESSION_SECRET = "test-only-secret";
    assert.equal((await middleware(new NextRequest("https://listord.example/admin/dashboard"))).status, 307);
    const token = await createAdminSession("test-only-secret");
    assert.equal((await middleware(new NextRequest("https://listord.example/admin/workers", { headers: { cookie: `admin_session=${token}` } }))).status, 200);
    assert.equal((await middleware(new NextRequest("https://listord.example/admin/login"))).status, 200);
    assert.equal((await middleware(new NextRequest("https://listord.example/admin/session", { method: "POST" }))).status, 200);
    assert.equal((await middleware(new NextRequest("https://listord.example/admin/session"))).status, 307);
    assert.equal((await middleware(new NextRequest("http://localhost:3188/admin/dashboard", { headers: { host: "127.0.0.1:3188" } }))).headers.get("location"), "http://127.0.0.1:3188/admin/login");
  } finally {
    if (before === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = before;
    if (flag === undefined) delete process.env.ADMIN_AUTH_ENABLED; else process.env.ADMIN_AUTH_ENABLED = flag;
  }
});

test("server guard rejects requests independently of middleware", async () => {
  const old = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "guard-test-secret";
  try {
    const valid = await createAdminSession("guard-test-secret");
    for (const value of [undefined, "wrong", valid]) {
      await withAdminCookie(value, async () => {
        if (value === valid) await assert.doesNotReject(requireAdmin);
        else await assert.rejects(requireAdmin, /NEXT_REDIRECT/);
      });
    }
  } finally {
    if (old === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = old;
  }
});
