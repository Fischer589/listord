// Match Next's server bootstrap before importing request-scoped APIs.
import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { isAdminSession } from "../lib/admin-session";
import { requireAdmin } from "../lib/admin-auth";
import { withAdminCookie } from "./request-context";

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

test("server guard rejects requests independently of middleware", async () => {
  const old = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "guard-test-secret";
  try {
    for (const value of [undefined, "wrong", "guard-test-secret"]) {
      await withAdminCookie(value, async () => {
        if (value === "guard-test-secret") await assert.doesNotReject(requireAdmin);
        else await assert.rejects(requireAdmin, /NEXT_REDIRECT/);
      });
    }
  } finally {
    if (old === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = old;
  }
});
