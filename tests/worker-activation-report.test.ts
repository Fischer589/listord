import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import test from "node:test";
import { withAdminCookie } from "./request-context";
import { createAdminSession } from "../lib/admin-session";
import { buildWorkerActivationReport, type ActivationRecord, type ActivationWorker } from "../lib/worker-activation-report";

const now = new Date("2026-10-19T12:00:00Z");
const worker = (id: string, changes: Partial<ActivationWorker> = {}): ActivationWorker => ({
  id, full_name: "Private name", city: "Santo Domingo", skills: ["Limpieza"], is_verified: true,
  available_now: true, owner_user_id: "11111111-1111-4111-8111-111111111111",
  created_at: "2025-01-01T00:00:00Z", desired_income: 1000, income_type: "daily", ...changes
});
const workers = [
  worker("00000000-0000-4000-8000-000000000001"),
  worker("00000000-0000-4000-8000-000000000002", { city: "SANTO DOMÍNGO", owner_user_id: null }),
  worker("00000000-0000-4000-8000-000000000003"),
  worker("00000000-0000-4000-8000-000000000004", { city: "Santiago", skills: ["Electricista"] }),
  worker("00000000-0000-4000-8000-000000000005", { is_verified: false }),
  worker("00000000-0000-4000-8000-000000000006", { city: "", skills: ["Otro oficio"] }),
];
const records: ActivationRecord[] = [
  { worker_id: workers[0].id, available: true, confirmed_at: "2026-10-18T12:00:00Z", access_expires_at: "2027-01-01T00:00:00Z" },
  { worker_id: workers[2].id, available: true, confirmed_at: "2026-09-01T12:00:00Z", access_expires_at: "2027-01-01T00:00:00Z" },
  { worker_id: workers[3].id, available: false, confirmed_at: "2026-10-18T12:00:00Z", access_expires_at: "2027-01-01T00:00:00Z" },
];

test("private report distinguishes verified, invited, confirmation and current guided eligibility", () => {
  const report = buildWorkerActivationReport(workers, records, now);
  assert.deepEqual(report.totals, { verified: 5, invited: 3, confirmedAvailable: 2, currentlyMatchable: 1 });
  assert.deepEqual(report.rows.find(row => row.city === "santo domingo" && row.category === "limpieza")?.counts,
    { verified: 3, invited: 2, confirmedAvailable: 2, currentlyMatchable: 1 });
  assert.deepEqual(report.rows.find(row => row.city === "santiago" && row.category === "electricidad")?.counts,
    { verified: 1, invited: 1, confirmedAvailable: 0, currentlyMatchable: 0 });
  assert.ok(report.rows.some(row => row.city === "sin ciudad" && row.category === "sin categoria"));
  assert.doesNotMatch(JSON.stringify(report), /Private name|00000000-|11111111-|token|phone|whatsapp/i);
  const expired = buildWorkerActivationReport(workers, [{ ...records[0], access_expires_at: "2026-10-18T00:00:00Z" }], now);
  assert.equal(expired.totals.currentlyMatchable, 0, "an expired private link is excluded even after explicit confirmation");
});

test("aggregate HTTP report is admin-only, paginates exact counts, and returns no worker data", async () => {
  const envKeys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_SESSION_SECRET"] as const;
  const before = envKeys.map(key => process.env[key]);
  const oldFetch = globalThis.fetch;
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://activation-fixture.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "fixture_service", ADMIN_SESSION_SECRET: "fixture-admin-secret" });
  let calls = 0;
  globalThis.fetch = async input => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, "https://activation-fixture.example.test");
    const selected = url.searchParams.get("select") ?? "";
    assert.doesNotMatch(selected, /whatsapp|phone|edit_token|token_hash|short_intro/);
    const data = url.pathname.endsWith("/workers") ? workers.filter(row => row.is_verified) : records;
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "content-range": `0-${data.length - 1}/${data.length}` } });
  };
  try {
    const { GET } = await import("../app/api/admin/worker-activation-report/route");
    await withAdminCookie(undefined, async () => assert.rejects(GET(), /NEXT_REDIRECT/));
    assert.equal(calls, 0);
    const token = await createAdminSession("fixture-admin-secret");
    await withAdminCookie(token, async () => {
      const response = await GET();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const text = await response.text();
      assert.doesNotMatch(text, /Private name|00000000-|11111111-|whatsapp|phone|token/i);
      const report = JSON.parse(text);
      assert.equal(report.totals.verified, 5);
    });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = oldFetch;
    envKeys.forEach((key, i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i]; });
  }
});
