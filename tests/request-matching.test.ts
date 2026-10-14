import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORIES } from "../lib/categories";
import { emptyRequest, REQUEST_SCHEMAS } from "../lib/request-specification";
import { findMatches, matchWorker, parseMatchRequest, MATCH_COLUMNS, type MatchRow } from "../lib/request-matching";

const now = new Date("2026-10-08T12:00:00Z");
const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", timing: "Fecha flexible", duration: "4 horas", amount: "1500", unit: "por día", answers: { property: "Casa", tasks: "Pisos y baños", supplies: "Los pongo yo" } };
const row: MatchRow = { id: "00000000-0000-4000-8000-000000000001", full_name: "Ana", city: "Puerto Plata", skills: ["Limpieza", "Pisos"], is_verified: true, available_now: true, created_at: "2026-10-01T12:00:00Z", desired_income: 1200, income_type: "daily" };

test("only explicit approval/availability and recent complete profiles qualify", () => {
  assert.ok(matchWorker(row, draft, now));
  for (const change of [
    { is_verified: false }, { is_verified: null }, { available_now: false }, { available_now: null },
    { created_at: null }, { created_at: "bad" }, { created_at: "2026-10-09" },
    { created_at: "2026-01-01", updated_at: now.toISOString(), boost_expires_at: "2027-01-01" },
    { full_name: "" }, { city: "Santo Domingo" }, { city: "Puerto Plata Norte" }, { skills: [] }, { skills: ["Hogar"] },
  ]) assert.equal(matchWorker({ ...row, ...change }, draft, now), null, JSON.stringify(change));
  assert.ok(matchWorker({ ...row, city: "  PUERTO PLÁTA " }, draft, now));
});
test("all 14 taxonomy labels match, without confusing adult and child care", () => {
  for (const category of CATEGORIES) {
    const d = { ...draft, category: category.searchKey };
    assert.ok(matchWorker({ ...row, skills: [category.label] }, d, now), category.label);
  }
  assert.equal(matchWorker({ ...row, skills: ["cuidadora"] }, { ...draft, category: "ninos" }, now), null);
  assert.equal(matchWorker({ ...row, skills: ["niñera"] }, { ...draft, category: "cuidadora" }, now), null);
});
test("compensation compares only supported identical units; scope is evidence, never a qualification claim", () => {
  assert.equal(matchWorker({ ...row, desired_income: 1600 }, draft, now), null);
  assert.ok(matchWorker({ ...row, desired_income: 1600, income_type: "monthly" }, draft, now));
  assert.ok(matchWorker({ ...row, desired_income: null }, draft, now));
  assert.deepEqual(matchWorker(row, draft, now)?.scopeEvidence, ["Pisos"]);
  assert.ok(matchWorker(row, { ...draft, requirements: "Licencia especial" }, now));
});
test("exact eligible count, stable order, privacy projection, zero, partial and DB failures", async () => {
  const privateRow = { ...row, whatsapp_number: "PRIVATE", edit_token: "SECRET", user_id: "OWNER", boost_expires_at: "2027" };
  const result = await findMatches(draft, async () => ({ data: [privateRow, { ...row, id: "2", available_now: false }], count: 2, error: null }), now);
  assert.equal(result.count, 1);
  assert.equal(result.workers.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|SECRET|OWNER|boost|whatsapp|edit_token|created_at/);
  assert.doesNotMatch(MATCH_COLUMNS, /whatsapp|edit_token|user_id|boost|\*/);
  assert.equal((await findMatches(draft, async () => ({ data: [], count: 0, error: null }), now)).count, 0);
  for (const page of [
    { data: [row], count: 2, error: null }, { data: [], count: 1001, error: null },
    { data: null, count: null, error: null }, { data: [], count: 0, error: { message: "SECRET database detail" } },
    { data: [row, row], count: 2, error: null },
  ]) await assert.rejects(findMatches(draft, async () => page, now), /MATCH_DATA_UNAVAILABLE/);
});
test("server parser rejects arbitrary JSON, incomplete answers and injected fields", () => {
  assert.ok(parseMatchRequest(draft));
  for (const invalid of [null, [], "text", 123, {}, { ...draft, city: 9 }, { ...draft, category: "__proto__" }, { ...draft, answers: null }, { ...draft, answers: { ...draft.answers, tasks: [] } }, { ...draft, answers: {} }, { ...draft, user_id: "injected" }, { ...draft, answers: { ...draft.answers, phone: "PRIVATE" } }, { ...draft, amount: "Infinity" }, { ...draft, requirements: "x".repeat(301) }]) assert.equal(parseMatchRequest(invalid), null);
  for (const category of CATEGORIES) {
    assert.ok(parseMatchRequest({ ...draft, category: category.searchKey, answers: Object.fromEntries(REQUEST_SCHEMAS[category.searchKey].map(q => [q.id, q.options?.[0] ?? "Detalle concreto"])) }));
  }
});

test("HTTP handlers keep matching free but reject anonymous contact before worker lookup", async () => {
  // Controlled transport fixture: executes production handlers/SDK, never production.
  const originalFetch = globalThis.fetch;
  const before = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://matching-fixture.example";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service";
  let mode = "ok";
  const recent = { ...row, created_at: new Date().toISOString(), whatsapp_number: "18095550100" };
  let selected = "";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://matching-fixture.example");
    assert.equal(init?.method, "GET");
    selected = url.searchParams.get("select") ?? "";
    if (mode === "error") return new Response(JSON.stringify({ message: "SECRET DB ERROR" }), { status: 500 });
    const contact = selected.includes("whatsapp_number");
    if (!contact) {
      assert.equal(url.searchParams.get("is_verified"), "eq.true");
      assert.equal(url.searchParams.get("available_now"), "eq.true");
      assert.equal(url.searchParams.get("limit"), "1000");
      assert.equal(url.searchParams.getAll("created_at").length, 2);
    }
    const records = mode === "empty" ? [] : [{ ...recent, available_now: mode !== "inactive" }];
    return new Response(JSON.stringify(contact ? records[0] ?? null : records), { headers: { "content-type": "application/json", "content-range": `0-${records.length - 1}/${mode === "partial" ? 5 : records.length}` } });
  };
  try {
    const { POST: matches } = await import("../app/api/requests/matches/route");
    const { POST: contact } = await import("../app/api/requests/contact/route");
    const request = (body: unknown) => new Request("https://listord.example/api/requests/matches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await matches(request({}))).status, 400);
    assert.equal((await matches(request({ ...draft, requirements: "x".repeat(13000) }))).status, 400);
    const crossOrigin = request(draft); crossOrigin.headers.set("origin", "https://evil.example");
    assert.equal((await matches(crossOrigin)).status, 400);
    const response = await matches(request(draft));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json(); assert.equal(body.count, 1);
    assert.doesNotMatch(JSON.stringify(body), /18095550100|whatsapp|edit_token/);
    assert.equal(selected, MATCH_COLUMNS);
    const handoff = await contact(request({ draft, workerId: row.id }));
    assert.equal(handoff.status, 401);
    assert.doesNotMatch(await handoff.text(), /18095550100|wa\.me/);
    assert.equal(selected, MATCH_COLUMNS);
    mode = "empty"; assert.equal((await (await matches(request(draft))).json()).count, 0);
    for (mode of ["partial", "error"]) {
      const failed = await matches(request(draft)); assert.equal(failed.status, 503);
      assert.doesNotMatch(await failed.text(), /SECRET|count|workers/);
    }
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal((await matches(request(draft))).status, 503);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "WORKER_AVAILABILITY_RENEWAL_ENABLED"]) {
      if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
    }
  }
});
