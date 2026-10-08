// Match Next's server bootstrap before importing request-scoped APIs.
import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { isAdminSession } from "../lib/admin-session";
import { requireAdmin } from "../lib/admin-auth";
import { requestAsyncStorage } from "next/dist/client/components/request-async-storage.external";

test("admin sessions fail closed for missing/wrong credentials", () => {
  assert.equal(isAdminSession(undefined, undefined), false);
  assert.equal(isAdminSession("", ""), false);
  assert.equal(isAdminSession("wrong", "secret"), false);
  assert.equal(isAdminSession(undefined, "secret"), false);
  assert.equal(isAdminSession("secret", "secret"), true);
});

test("middleware denies admin even when the legacy bypass flag is false", () => {
  const before = process.env.ADMIN_SESSION_SECRET;
  const flag = process.env.ADMIN_AUTH_ENABLED;
  try {
    process.env.ADMIN_AUTH_ENABLED = "false";
    delete process.env.ADMIN_SESSION_SECRET;
    assert.equal(middleware(new NextRequest("https://listord.example/admin/workers")).status, 307);
    process.env.ADMIN_SESSION_SECRET = "test-only-secret";
    assert.equal(middleware(new NextRequest("https://listord.example/admin/dashboard")).status, 307);
    assert.equal(middleware(new NextRequest("https://listord.example/admin/workers", { headers: { cookie: "admin_session=test-only-secret" } })).status, 200);
    assert.equal(middleware(new NextRequest("https://listord.example/admin/login")).status, 200);
  } finally {
    if (before === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = before;
    if (flag === undefined) delete process.env.ADMIN_AUTH_ENABLED; else process.env.ADMIN_AUTH_ENABLED = flag;
  }
});

test("server guard rejects requests independently of middleware", () => {
  const old = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "guard-test-secret";
  try {
    for (const value of [undefined, "wrong", "guard-test-secret"]) {
      const store = { cookies: { get: () => value ? { value } : undefined } } as unknown as Parameters<typeof requestAsyncStorage.run>[0];
      requestAsyncStorage.run(store, () => {
        if (value === "guard-test-secret") assert.doesNotThrow(requireAdmin);
        else assert.throws(requireAdmin, /NEXT_REDIRECT/);
      });
    }
  } finally {
    if (old === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = old;
  }
});
