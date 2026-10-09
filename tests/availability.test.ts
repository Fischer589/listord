import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { withAdminCookie } from "./request-context";
import { isFreshAvailability, validAvailabilityKey } from "../lib/availability";
import { matchWorker } from "../lib/request-matching";
import { emptyRequest } from "../lib/request-specification";

const id = "22222222-2222-4222-8222-222222222222";
const key = "a".repeat(64);
const hash = createHash("sha256").update(key).digest("hex");

test("30-day renewal expiration excludes future/unknown/paused state; old workers can renew", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(isFreshAvailability(true, "2026-10-07", now), true);
  for (const stamp of [null, "bad", "2026-10-09", "2026-09-08T12:00:00Z", "2026-01-01"]) assert.equal(isFreshAvailability(true, stamp, now), false);
  assert.equal(isFreshAvailability(false, now.toISOString(), now), false);
  assert.equal(validAvailabilityKey("22222222-2222-4222-8222-222222222222"), false, "legacy edit tokens do not authorize renewal");
  const worker = { id, full_name: "Fixture", city: "Puerto Plata", skills: ["Limpieza"], is_verified: true, available_now: true, created_at: "2025-01-01", desired_income: 1000, income_type: "daily", availability_confirmed_at: now.toISOString() };
  const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", compensation: "negotiable" as const };
  assert.equal(matchWorker(worker, draft, now), null, "legacy safeguard remains default");
  assert.ok(matchWorker(worker, draft, now, "confirmed"));
  assert.equal(matchWorker({ ...worker, is_verified: false }, draft, now, "confirmed"), null);
  assert.equal(matchWorker({ ...worker, availability_confirmed_at: null }, draft, now, "confirmed"), null);
});

test("unapplied migration: private grants, approved ownership issuance, atomic renewal/pause/reissue, no backfill", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table workers(id uuid primary key, full_name text, photo_url text, edit_token text, available_now boolean default false, is_verified boolean, created_at timestamptz default now());
      grant select, update on workers to service_role;
      insert into workers values('${id}','Preserved','original-photo','legacy-token',false,true,'2025-01-01');`);
    const before = (await db.query("select * from workers")).rows;
    await db.exec(await readFile(new URL("../supabase/migrations/202610081400_worker_availability.sql", import.meta.url), "utf8"));
    assert.deepEqual((await db.query("select * from workers")).rows, before);
    assert.equal((await db.query("select * from worker_availability")).rows.length, 0);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select token_hash from worker_availability"), /permission denied/);
      await assert.rejects(db.query("select issue_worker_availability($1,$2)", [id, hash]), /permission denied/);
      await assert.rejects(db.query("select * from renew_worker_availability($1,true)", [hash]), /permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    await db.query("select issue_worker_availability($1,$2)", [id, hash]);
    assert.equal((await db.query("select * from renew_worker_availability($1,true)", ["b".repeat(64)])).rows.length, 0);
    const renewed = await db.query<{ available: boolean; confirmed_at: Date }>("select * from renew_worker_availability($1,true)", [hash]);
    assert.equal(renewed.rows[0].available, true);
    assert.ok(renewed.rows[0].confirmed_at);
    assert.deepEqual((await db.query("select full_name,photo_url,edit_token,available_now from workers")).rows, [{ full_name: "Preserved", photo_url: "original-photo", edit_token: "legacy-token", available_now: true }]);
    await db.query("select * from renew_worker_availability($1,false)", [hash]);
    assert.deepEqual((await db.query("select available_now from workers")).rows, [{ available_now: false }]);
    await db.query("select issue_worker_availability($1,$2)", [id, "c".repeat(64)]);
    assert.equal((await db.query("select * from renew_worker_availability($1,true)", [hash])).rows.length, 0, "old link revoked");
    await db.exec("update worker_availability set access_expires_at=now()-interval '1 day'");
    assert.equal((await db.query("select * from renew_worker_availability($1,true)", ["c".repeat(64)])).rows.length, 0);
    await db.exec("update workers set is_verified=false");
    await assert.rejects(db.query("select issue_worker_availability($1,$2)", [id, hash]), /worker unavailable/);
  } finally { await db.close(); }
});

test("HTTP renewal requires private key, server gate, CSRF checks and admin authorization; no secrets in results", async () => {
  const oldEnv = { ...process.env };
  const oldFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://availability-fixture.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
  process.env.ADMIN_SESSION_SECRET = "test-admin";
  let mode = "ok";
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, "https://availability-fixture.example");
    if (mode === "error") return new Response(JSON.stringify({ message: "PRIVATE DB DETAILS" }), { status: 500 });
    if (url.pathname.endsWith("/renew_worker_availability")) {
      const body = JSON.parse(String(init?.body)); assert.equal(body.p_token_hash, hash);
      assert.deepEqual(Object.keys(body).sort(), ["p_available", "p_token_hash"]);
      return new Response(JSON.stringify(mode === "revoked" ? [] : [{ available: body.p_available, confirmed_at: new Date().toISOString() }]), { headers: { "content-type": "application/json" } });
    }
    if (url.pathname.endsWith("/issue_worker_availability")) {
      const body = JSON.parse(String(init?.body)); assert.equal(body.p_worker_id, id); assert.match(body.p_token_hash, /^[a-f0-9]{64}$/);
      return new Response(null, { status: 204 });
    }
    if (!url.searchParams.has("token_hash")) {
      assert.equal(url.searchParams.get("available"), "eq.true");
      assert.equal(url.searchParams.get("workers.is_verified"), "eq.true");
      assert.ok(url.searchParams.has("access_expires_at"));
      return new Response(JSON.stringify([{ confirmed_at: new Date(Date.now() - 1000).toISOString(), workers: { id, full_name: "Fixture", city: "Puerto Plata", skills: ["Limpieza"], is_verified: true, available_now: true, created_at: "2020-01-01", desired_income: 1000, income_type: "daily" } }]), { headers: { "content-type": "application/json", "content-range": "0-0/1" } });
    }
    assert.equal(url.searchParams.get("token_hash"), `eq.${hash}`);
    return new Response(JSON.stringify([{ available: true, confirmed_at: new Date().toISOString() }]), { headers: { "content-type": "application/json" } });
  };
  try {
    const { POST } = await import("../app/api/workers/availability/route");
    const { POST: issue } = await import("../app/api/admin/availability-access/route");
    const req = (body: unknown) => new Request("https://listord.example/api/workers/availability", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    process.env.WORKER_AVAILABILITY_RENEWAL_ENABLED = "false";
    assert.equal((await POST(req({ key, action: "renew", available: true }))).status, 503);
    assert.equal(calls, 0);
    process.env.WORKER_AVAILABILITY_RENEWAL_ENABLED = "true";
    assert.equal((await POST(req({ key: id, action: "renew", available: true }))).status, 400);
    assert.equal((await POST(req({ key, action: "renew", available: "true" }))).status, 400);
    const cross = req({ key, action: "renew", available: true }); cross.headers.set("origin", "https://evil.example");
    assert.equal((await POST(cross)).status, 400);
    const response = await POST(req({ key, action: "renew", available: true }));
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json(); assert.equal(body.fresh, true); assert.doesNotMatch(JSON.stringify(body), new RegExp(`${key}|${hash}|${id}`));
    assert.equal((await (await POST(req({ key, action: "status" }))).json()).fresh, true);
    assert.equal((await (await POST(req({ key, action: "renew", available: false }))).json()).fresh, false);
    mode = "revoked"; assert.equal((await POST(req({ key, action: "renew", available: true }))).status, 403);
    mode = "error"; const error = await POST(req({ key, action: "renew", available: true })); assert.equal(error.status, 503); assert.doesNotMatch(await error.text(), /PRIVATE/);
    mode = "ok";
    const { getRequestMatches } = await import("../lib/request-match-server");
    const matched = await getRequestMatches({ ...emptyRequest(), category: "limpieza", city: "Puerto Plata", compensation: "negotiable" });
    assert.equal(matched.count, 1); assert.equal(matched.freshness, "confirmed");
    assert.doesNotMatch(JSON.stringify(matched), /token_hash|confirmed_at|access_expires_at/);
    mode = "error"; await assert.rejects(getRequestMatches({ ...emptyRequest(), category: "limpieza", city: "Puerto Plata" })); mode = "ok";
    for (const cookie of [undefined, "wrong", "test-admin"]) {
      await withAdminCookie(cookie, async () => {
        if (cookie !== "test-admin") await assert.rejects(issue(req({ workerId: id, ownershipConfirmed: true })), /NEXT_REDIRECT/);
        else {
          assert.equal((await issue(req({ workerId: id, ownershipConfirmed: false }))).status, 400);
          assert.equal((await issue(req({ workerId: id, ownershipConfirmed: true }))).status, 400, "consent is required separately from ownership");
          const issued = await issue(req({ workerId: id, ownershipConfirmed: true, consentConfirmed: true }));
          assert.equal(issued.status, 200); assert.match((await issued.json()).path, /^\/trabajadores\/disponibilidad#clave=[a-f0-9]{64}$/);
        }
      });
    }
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_SESSION_SECRET", "WORKER_AVAILABILITY_RENEWAL_ENABLED"]) {
      if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
    }
  }
});
