import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeAnalytics } from "../lib/analytics-policy";
import { readJsonBody } from "../lib/http-json";
import { submitHiringOutcome } from "../app/resultados/actions";
import { upsertEmployerSession } from "../lib/employer-sessions";
import { emptyRequest } from "../lib/request-specification";

const url = "https://listord.example/api/analytics/events";
const request = (body: string, headers = {}) => new Request(url, {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body
});

test("analytics drops capabilities, phones, payment IDs, unknown paths and forged financial events", () => {
  const sanitized = sanitizeAnalytics({ event_name: "page_view", metadata: {
    path: "/trabajadores/editar?token=private#private", phone: "private", token: "private",
    checkout_session_id: "private", session_id: "private", nested: { secret: "private" }
  } });
  assert.deepEqual(sanitized, { event_name: "page_view", metadata: { path: "/trabajadores/editar" } });
  assert.deepEqual(sanitizeAnalytics({ event_name: "page_view", metadata: { path: "/private-secret" } })?.metadata, {});
  assert.equal(sanitizeAnalytics({ event_name: "page_view", metadata: { path: "/trabajador/private-name" } })?.metadata.path, "/trabajador/[slug]");
  for (const event_name of ["checkout_success", "boost_activated", "boost_payment_success", "boost_expired", {}, 10]) {
    assert.equal(sanitizeAnalytics({ event_name }), null);
  }
  for (const body of [null, [], 1, "event"]) assert.equal(sanitizeAnalytics(body), null);
});

test("JSON reader bounds streamed UTF-8 bytes regardless of content length and rejects cross-origin/invalid bodies", async () => {
  assert.deepEqual(await readJsonBody(request('{"valid":true}'), 32), { valid: true });
  await assert.rejects(readJsonBody(request(JSON.stringify("é".repeat(30)), { "content-length": "1" }), 32));
  await assert.rejects(readJsonBody(request("{}", { origin: "https://evil.example" })));
  await assert.rejects(readJsonBody(request("{}", { "content-type": "text/plain" })));
  await assert.rejects(readJsonBody(request("invalid")));
});

test("JSON reader accepts only the configured HTTPS public origin when Netlify uses an internal request URL", async () => {
  const previous = process.env.APP_ORIGIN;
  try {
    process.env.APP_ORIGIN = "https://listordapp.com";
    assert.deepEqual(await readJsonBody(request('{"valid":true}', { origin: "https://listordapp.com" })), { valid: true });
    await assert.rejects(readJsonBody(request("{}", { origin: "https://listordapp.com.evil.example" })));
    await assert.rejects(readJsonBody(request("{}", { origin: "https://evil.example" })));
    for (const invalid of ["http://listordapp.com", "https://user:pass@listordapp.com", "https://listordapp.com/path"]) {
      process.env.APP_ORIGIN = invalid;
      await assert.rejects(readJsonBody(request("{}", { origin: "https://listordapp.com" })));
    }
  } finally {
    if (previous === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previous;
  }
});

test("legacy outcome action cannot write or claim success from a caller-supplied ID", async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Unexpected database access"); };
  try {
    const form = new FormData();
    form.set("contact_request_id", "22222222-2222-4222-8222-222222222222");
    form.set("answered_by", "employer"); form.set("answer", "yes");
    await assert.rejects(submitHiringOutcome(form), error => {
      assert.match((error as { digest: string }).digest, /status=pendiente/);
      return true;
    });
    assert.equal(calls, 0);
  } finally { globalThis.fetch = oldFetch; }
});

test("employer session tracking reports database write failures", async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://session-fixture.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
  let calls = 0;
  globalThis.fetch = async input => {
    calls++;
    assert.equal(new URL(String(input)).pathname, "/rest/v1/employer_sessions");
    return new Response(JSON.stringify({ code: "23514", message: "fixture write failed" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  };
  try {
    assert.equal(await upsertEmployerSession({ browserSessionId: "fixture-session" }), false);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("registration rejects malformed/oversized fields and never accepts caller-supplied activation", async () => {
  const { parseWorkerRegistration } = await import("../lib/registration-validation");
  const valid = () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ full_name: "Fixture Worker", city: "Puerto Plata", job_category: "Limpieza", whatsapp_number: "8095550100" })) form.set(key, value);
    return form;
  };
  const form = valid(); form.set("is_verified", "true"); form.set("available_now", "true");
  const result = parseWorkerRegistration(form);
  assert.equal(result?.whatsapp_number, "+18095550100");
  assert.equal(result?.is_verified, false); assert.equal(result?.available_now, false);
  for (const [key, value] of [["full_name", "x".repeat(101)], ["city", ""], ["desired_income", "Infinity"], ["desired_income", "-1"], ["work_style", "admin"], ["whatsapp_number", "9".repeat(16)], ["whatsapp_number", "letters8095550100"], ["skills", "x,".repeat(21)]]) {
    const bad = valid(); bad.set(key, value); assert.equal(parseWorkerRegistration(bad), null, key);
  }
  const duplicate = valid(); duplicate.append("full_name", "second"); assert.equal(parseWorkerRegistration(duplicate), null);
});

test("default-off legacy gates reject sales and exposed edit capabilities without external calls", async () => {
  const original = { edit: process.env.LEGACY_WORKER_EDIT_ENABLED, sales: process.env.LEGACY_CHECKOUT_ENABLED };
  delete process.env.LEGACY_WORKER_EDIT_ENABLED; delete process.env.LEGACY_CHECKOUT_ENABLED;
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Unexpected external access"); };
  try {
    const { findBoostableWorkerByEditToken } = await import("../lib/boost-data");
    assert.equal(await findBoostableWorkerByEditToken("22222222-2222-4222-8222-222222222222"), null);
    const routes = await Promise.all([
      import("../app/api/stripe/checkout/route"), import("../app/api/stripe/worker-checkout/route"),
      import("../app/api/stripe/boost-checkout/route"), import("../app/api/stripe/employer-deposit-checkout/route")
    ]);
    for (const { POST } of routes) assert.equal((await POST(request("{}"))).status, 503);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = oldFetch;
    if (original.edit === undefined) delete process.env.LEGACY_WORKER_EDIT_ENABLED; else process.env.LEGACY_WORKER_EDIT_ENABLED = original.edit;
    if (original.sales === undefined) delete process.env.LEGACY_CHECKOUT_ENABLED; else process.env.LEGACY_CHECKOUT_ENABLED = original.sales;
  }
});

test("directory contact is a bounded read-only approved-worker handoff, independent of payments", async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://contact-fixture.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
  let calls = 0;
  let missing = false;
  globalThis.fetch = async (input, init) => {
    calls++;
    const target = new URL(String(input));
    assert.equal(target.origin, "https://contact-fixture.example");
    assert.equal(target.pathname, "/rest/v1/workers");
    assert.equal(init?.method, "GET");
    assert.equal(target.searchParams.get("is_verified"), "eq.true");
    return new Response(JSON.stringify(missing ? [] : [{ full_name: "Fixture Worker", whatsapp_number: "+18095550100" }]), { headers: { "content-type": "application/json" } });
  };
  try {
    const { POST } = await import("../app/api/workers/contact/route");
    assert.equal((await POST(request('{"workerId":{}}'))).status, 400);
    assert.equal(calls, 0);
    const response = await POST(request('{"workerId":"22222222-2222-4222-8222-222222222222"}'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const result = await response.json();
    assert.equal(new URL(result.url).origin, "https://wa.me");
    assert.match(new URL(result.url).searchParams.get("text")!, /Fixture Worker/);
    assert.match(new URL(result.url).searchParams.get("text")!, /22222222-2222-4222-8222-222222222222/);
    assert.equal(result.reason, "free_contact");
    const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", answers: {
      property: "Casa", tasks: "Pisos y baños", supplies: "Los pongo yo"
    }, timing: "15 de octubre, 9:00 a. m.", duration: "4 horas", amount: "1500", exclusions: "Cocinar" };
    const contextual = await POST(request(JSON.stringify({ workerId: "22222222-2222-4222-8222-222222222222", draft })));
    assert.equal(contextual.status, 200);
    const message = new URL((await contextual.json()).url).searchParams.get("text")!;
    for (const detail of ["Fixture Worker", "LIMPIEZA", "Puerto Plata", "Pisos y baños", "15 de octubre, 9:00 a. m.", "4 horas", "RD$1,500", "No incluye: Cocinar"]) {
      assert.ok(message.includes(detail), detail);
    }
    assert.match(message, /confirmar tu disponibilidad/);
    assert.doesNotMatch(message, /disponibilidad confirmada|aceptaste|garantiz/i);
    assert.equal((await POST(request(JSON.stringify({ workerId: "22222222-2222-4222-8222-222222222222", draft: { ...draft, answers: { ...draft.answers, private: "no" } } })))).status, 400);
    assert.equal(calls, 2);
    missing = true; assert.equal((await POST(request('{"workerId":"22222222-2222-4222-8222-222222222222"}'))).status, 404);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});


test("funnel timings and zero-match counts are bounded and contain no request/contact text", () => {
  const result = sanitizeAnalytics({ event_name: "request_matches", metadata: { elapsed_ms: 1200, match_count: 0, phone: "18090000111", draft: "private text" } });
  assert.deepEqual(result, { event_name: "request_matches", metadata: { elapsed_ms: 1200, match_count: 0 } });
  assert.deepEqual(sanitizeAnalytics({ event_name: "request_contact", metadata: { elapsed_ms: Infinity, match_count: -1 } })?.metadata, {});
});

test("Supabase deadline covers retries and preserves caller cancellation", async () => {
  const { getSupabaseClient } = await import("../lib/supabase");
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const old = names.map(n => process.env[n]); const original = globalThis.fetch;
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://deadline-fixture.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_public" });
  const signals: AbortSignal[] = [];
  globalThis.fetch = async (_input, init) => { signals.push(init!.signal!); return Response.json([]); };
  try {
    const client = getSupabaseClient(20)!;
    await client.from("workers").select("id");
    await new Promise(resolve => setTimeout(resolve, 30));
    await client.from("workers").select("id");
    assert.equal(signals[0].aborted, true);
    assert.equal(signals[1].aborted, true, "retry cannot receive a fresh deadline");
    const caller = new AbortController(); caller.abort();
    await getSupabaseClient(8000)!.from("workers").select("id").abortSignal(caller.signal);
    assert.equal(signals[2].aborted, true, "caller cancellation is never overwritten");
  } finally { globalThis.fetch = original; names.forEach((n, i) => { if (old[i] === undefined) delete process.env[n]; else process.env[n] = old[i]; }); }
});
