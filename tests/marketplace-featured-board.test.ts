import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/marketplace/route";

test("public board leads with only active paid opportunities and never returns private payment or contact fields", async () => {
  const names = ["MARKETPLACE_ENABLED", "FEATURED_OPPORTUNITIES_ENABLED", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const old = names.map(name => process.env[name]);
  const oldFetch = globalThis.fetch;
  Object.assign(process.env, { MARKETPLACE_ENABLED: "true", FEATURED_OPPORTUNITIES_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://fixture.example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture_service" });
  const featured = "11111111-1111-4111-8111-111111111111";
  const ordinary = "22222222-2222-4222-8222-222222222222";
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/marketplace_featured_orders")) {
      assert.equal(url.searchParams.get("status"), "eq.paid");
      assert.match(url.searchParams.get("featured_until") ?? "", /^gt\./);
      return Response.json([{ opportunity_id: featured }]);
    }
    assert.equal(url.pathname, "/rest/v1/marketplace_opportunities");
    assert.equal(url.searchParams.get("status"), "eq.open");
    assert.equal(url.searchParams.get("moderation_status"), "eq.approved");
    assert.match(url.searchParams.get("expires_at") ?? "", /^gt\./);
    const row = (id: string) => ({ id, category: "limpieza", city: "Santo Domingo", scope: "Limpieza semanal", specification: {},
      compensation_kind: "negotiable", compensation_min: null, compensation_unit: null, expires_at: "2099-01-01T00:00:00Z", status: "open" });
    return Response.json(url.searchParams.has("id") ? [row(featured)] : [row(ordinary), row(featured)]);
  };
  try {
    const response = await GET(new Request("https://example.test/api/marketplace"));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.opportunities.map((row: { id: string; featured: boolean }) => [row.id, row.featured]), [[featured, true], [ordinary, false]]);
    assert.doesNotMatch(JSON.stringify(data), /stripe_|owner_user_id|whatsapp_number|contact_name/);
  } finally {
    globalThis.fetch = oldFetch;
    names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]; });
  }
});
