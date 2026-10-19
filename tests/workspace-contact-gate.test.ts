import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { POST as directoryContact } from "../app/api/workers/contact/route";
import { POST as requestContact } from "../app/api/requests/contact/route";
import { POST as applicantContact } from "../app/api/marketplace/contacts/route";
import { emptyRequest } from "../lib/request-specification";

const employer = "11111111-1111-4111-8111-111111111111";
const other = "33333333-3333-4333-8333-333333333333";
const worker = "22222222-2222-4222-8222-222222222222";
const workerOwner = "55555555-5555-4555-8555-555555555555";
const opportunity = "44444444-4444-4444-8444-444444444444";
const draft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", timing: "Fecha flexible", duration: "4 horas", amount: "1500", unit: "por día", answers: { property: "Casa", tasks: "Pisos y baños", supplies: "Los pongo yo" } };

test("all contact endpoints deny anonymous, unpaid, mismatched, expired and refunded accounts before returning a phone", async () => {
  const names = ["MARKETPLACE_ENABLED", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const old = names.map(name => process.env[name]);
  const fetchBefore = globalThis.fetch;
  Object.assign(process.env, { MARKETPLACE_ENABLED: "true", STRIPE_SECRET_KEY: "sk_live_fixture", NEXT_PUBLIC_SUPABASE_URL: "https://contact-fixture.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture_anon", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  let status: "unpaid" | "paid" | "expired" | "refunded" = "unpaid";
  let linkedOwner = employer;
  let profileOwner: string | null = workerOwner;
  let availability: "fresh" | "missing" | "stale" = "fresh";
  let paidSessionMode: "live" | "test" = "live";
  let contactReads = 0;
  let handoffs = 0;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: employer, email_confirmed_at: "2026-01-01T00:00:00Z" });
    if (url.pathname === "/rest/v1/rpc/authorize_worker_contact") {
      const paid = status === "paid" && linkedOwner === employer && paidSessionMode === "live";
      return Response.json([{ allowed: paid, source: paid ? "workspace" : "payment_required",
        source_order: paid ? "paid-order" : null, remaining: 0, already_unlocked: paid }]);
    }
    if (url.pathname === "/rest/v1/employer_workspace_orders") {
      assert.equal(url.searchParams.get("owner_user_id"), `eq.${employer}`);
      assert.equal(url.searchParams.get("status"), "eq.paid");
      assert.equal(url.searchParams.get("stripe_session_id"), "like.cs\\_live\\_%");
      return Response.json(status === "paid" && linkedOwner === employer && paidSessionMode === "live" ? [{ id: "paid-order" }] : []);
    }
    if (url.pathname === "/rest/v1/rpc/marketplace_contacts_v2" ||
        (url.pathname === "/rest/v1/workers" && url.searchParams.get("select")?.includes("whatsapp_number"))) contactReads++;
    if (url.pathname === "/rest/v1/workers") return Response.json({ id: worker, full_name: "Ana", city: "Puerto Plata", skills: ["Limpieza"],
      whatsapp_number: "18095550100", owner_user_id: profileOwner, is_verified: true, available_now: true, created_at: new Date().toISOString(), desired_income: 1200, income_type: "daily" });
    if (url.pathname === "/rest/v1/worker_availability") {
      assert.equal(url.searchParams.get("worker_id"), `eq.${worker}`);
      assert.equal(url.searchParams.get("available"), "eq.true");
      assert.ok(url.searchParams.get("access_expires_at")?.startsWith("gt."));
      if (availability === "missing") return Response.json(null);
      return Response.json({ confirmed_at: new Date(Date.now() - (availability === "stale" ? 31 : 1) * 86400000).toISOString() });
    }
    if (url.pathname === "/rest/v1/employer_contact_handoffs") { handoffs++; return Response.json(null, { status: 201 }); }
    if (url.pathname === "/rest/v1/marketplace_opportunities") return Response.json({ id: opportunity });
    if (url.pathname === "/rest/v1/marketplace_opportunity_owners") return Response.json({ opportunity_id: opportunity });
    if (url.pathname === "/rest/v1/rpc/marketplace_contacts_v2") return Response.json([{ worker_id: worker, worker_name: "Ana", name: "Ana", phone: "18095550100" }]);
    throw new Error(`Unexpected contact query: ${url.pathname}`);
  };
  const token = "fixture_employer_token_verified_123456789";
  const request = (path: string, body: unknown, authenticated = true) => new Request(`https://listord.example${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const cases = [
    [directoryContact, "/api/workers/contact", { workerId: worker }],
    [requestContact, "/api/requests/contact", { workerId: worker, draft }],
    [applicantContact, "/api/marketplace/contacts", { workerId: worker, id: opportunity }],
  ] as const;
  try {
    for (const [handler, path, body] of cases) {
      assert.equal((await handler(request(path, body, false))).status, 401);
      assert.equal((await handler(request(path, body))).status, 402);
    }
    assert.equal(contactReads, 0);
    for (status of ["expired", "refunded"] as const) {
      const denied = await directoryContact(request("/api/workers/contact", { workerId: worker }));
      assert.equal(denied.status, 402);
      assert.doesNotMatch(await denied.text(), /18095550100|wa\.me/);
    }
    status = "paid"; linkedOwner = other;
    assert.equal((await directoryContact(request("/api/workers/contact", { workerId: worker }))).status, 402);
    linkedOwner = employer;
    paidSessionMode = "test";
    assert.equal((await directoryContact(request("/api/workers/contact", { workerId: worker }))).status, 402);
    paidSessionMode = "live";
    for (const [handler, path, body] of cases) {
      const allowed = await handler(request(path, body));
      assert.equal(allowed.status, 200, path);
      assert.match((await allowed.text()), /wa\.me\/18095550100/);
      assert.equal(allowed.headers.get("cache-control"), "private, no-store");
    }
    assert.equal(handoffs, cases.length);
    for (const [owner, state] of [[null, "fresh"], [workerOwner, "missing"], [workerOwner, "stale"]] as const) {
      profileOwner = owner;
      availability = state;
      const denied = await requestContact(request("/api/requests/contact", { workerId: worker, draft }));
      assert.equal(denied.status, 409, `${owner ?? "unowned"}/${state}`);
      assert.doesNotMatch(await denied.text(), /18095550100|wa\.me/);
      assert.equal(handoffs, cases.length, "ineligible workers never create a contact handoff");
    }
  } finally {
    globalThis.fetch = fetchBefore;
    names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]; });
  }
});
