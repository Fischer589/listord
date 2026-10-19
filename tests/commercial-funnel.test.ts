import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { sanitizeAnalytics } from "../lib/analytics-policy";
import { POST as analyticsPost } from "../app/api/analytics/events/route";

const session = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const owner = "11111111-1111-4111-8111-111111111111";
const worker = "22222222-2222-4222-8222-222222222222";

test("private daily funnel accepts request events, attributes only bound orders and counts paid orders once", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.workers(id uuid primary key);
      insert into auth.users values('${owner}'); insert into public.workers values('${worker}');`);
    for (const file of ["202604271300_add_analytics_events.sql", "202610111900_employer_workspace.sql",
      "202610141300_direct_contact_orders.sql", "202610181200_commercial_funnel_integrity.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.exec(`alter table workers add column full_name text, add column is_verified boolean,
      add column whatsapp_number text;
      create table premium_access(id uuid primary key,status text,paid_access_until timestamptz,
        stripe_checkout_session_id text);`);
    await db.exec(await readFile(new URL("../supabase/migrations/20261019202538_contact_credit_ledger.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20261019202539_contact_credit_funnel.sql", import.meta.url), "utf8"));
    await db.exec("set time zone 'America/New_York'");
    const accepted = ["request_started", "request_preview", "request_abandoned", "request_matches", "request_contact", "directory_search_submitted"];
    for (const event of accepted) await db.query("insert into analytics_events(event_name,metadata,created_at) values($1,$2,$3)",
      [event, { session_id: session }, "2026-10-18T01:00:00Z"]);
    await assert.rejects(db.query("insert into analytics_events(event_name) values('forged_payment')"), /analytics_events_event_name_check/);
    const direct = (await db.query<{id:string}>(`insert into employer_direct_contact_orders
      (owner_user_id,worker_id,stripe_session_id,browser_session_id,status,paid_at,stripe_payment_intent_id,created_at)
      values($1,$2,'cs_test_direct_bound',$3,'paid','2026-10-18T02:00:00Z','pi_direct','2026-10-18T01:00:00Z') returning id`,
      [owner, worker, session])).rows[0].id;
    await db.query(`insert into employer_workspace_orders(owner_user_id,browser_session_id,created_at)
      values($1,$2,'2026-10-18T01:00:00Z')`, [owner, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]);
    await db.query("insert into analytics_events(event_name,metadata,created_at) values('page_view',$1,'2026-10-18T01:00:00Z')", [{ session_id: session, path: "/" }]);
    await db.query("insert into analytics_events(event_name,metadata,created_at) values('checkout_success',$1,'2026-10-18T02:00:00Z')", [{ session_id: session, plan: "workspace" }]);
    await db.query("insert into employer_contact_handoffs(order_id,product,route,created_at) values($1,'direct','worker','2026-10-18T03:00:00Z')", [direct]);
    const rows = (await db.query<{day:string | Date; product:string; visits:number; searches:number; checkout_starts:number; paid_orders:number; net_collected_cents:number; authorized_handoffs:number}>(
      "select * from commercial_funnel_daily order by day,product")).rows;
    assert.deepEqual(rows.map(row => ({ day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day), product: row.product, visits: Number(row.visits), searches: Number(row.searches),
      starts: Number(row.checkout_starts), paid: Number(row.paid_orders), cents: Number(row.net_collected_cents), handoffs: Number(row.authorized_handoffs) })),
      [{ day: "2026-10-18", product: "direct", visits: 1, searches: 2, starts: 1, paid: 1, cents: 8900, handoffs: 1 }]);
    await db.query("update employer_direct_contact_orders set status='refunded',reversed_at='2026-10-19T01:00:00Z',reversal_kind='refund' where id=$1", [direct]);
    await db.query(`insert into employer_payment_reversals(stripe_event_id,order_id,product,kind,cumulative_amount_cents,occurred_at)
      values('evt_partial_1',$1,'direct','refund',3000,'2026-10-19T01:00:00Z')`, [direct]);
    await db.query(`insert into employer_payment_reversals(stripe_event_id,order_id,product,kind,cumulative_amount_cents,occurred_at)
      values('evt_partial_2',$1,'direct','refund',8900,'2026-10-20T01:00:00Z')`, [direct]);
    await db.query(`insert into employer_payment_reversals(stripe_event_id,order_id,product,kind,cumulative_amount_cents,occurred_at)
      values('evt_partial_1',$1,'direct','refund',3000,'2026-10-19T01:00:00Z') on conflict do nothing`, [direct]);
    const refund = (await db.query<{refunds:number;net_collected_cents:number}>(
      "select refunds,net_collected_cents from commercial_funnel_daily where day='2026-10-19' and product='direct' ")).rows[0];
    assert.equal(Number(refund.refunds), 1);
    assert.equal(Number(refund.net_collected_cents), -3000);
    const secondRefund = (await db.query<{refunds:number;net_collected_cents:number}>(
      "select refunds,net_collected_cents from commercial_funnel_daily where day='2026-10-20' and product='direct' ")).rows[0];
    assert.equal(Number(secondRefund.refunds), 1);
    assert.equal(Number(secondRefund.net_collected_cents), -5900);
    const credit = (await db.query<{id:string}>(`insert into employer_contact_credit_orders
      (owner_user_id,pack_size,amount,status,credits_remaining,stripe_session_id,stripe_payment_intent_id,paid_at,created_at)
      values($1,5,44500,'paid',5,'cs_test_credit_bound','pi_credit','2026-10-18T02:00:00Z','2026-10-18T01:00:00Z') returning id`, [owner])).rows[0].id;
    const creditSale = (await db.query<{paid_orders:number;net_collected_cents:number}>(
      "select paid_orders,net_collected_cents from commercial_funnel_daily where day='2026-10-18' and product='credit'")).rows[0];
    assert.equal(Number(creditSale.paid_orders), 1);
    assert.equal(Number(creditSale.net_collected_cents), 44500);
    await db.query(`insert into employer_payment_reversals(stripe_event_id,order_id,product,kind,cumulative_amount_cents,occurred_at)
      values('evt_credit_refund',$1,'credit','refund',10000,'2026-10-19T01:00:00Z')`, [credit]);
    const creditRefund = (await db.query<{refunded_cents:number;net_collected_cents:number}>(
      "select refunded_cents,net_collected_cents from commercial_funnel_daily where day='2026-10-19' and product='credit'")).rows[0];
    assert.equal(Number(creditRefund.refunded_cents), 10000);
    assert.equal(Number(creditRefund.net_collected_cents), -10000);
    const lostCredit = (await db.query<{id:string}>(`insert into employer_contact_credit_orders
      (owner_user_id,pack_size,amount,status,credits_remaining,stripe_session_id,stripe_payment_intent_id,paid_at,created_at)
      values($1,1,10000,'disputed',0,'cs_test_credit_lost','pi_credit_lost','2026-10-21T02:00:00Z','2026-10-21T01:00:00Z') returning id`, [owner])).rows[0].id;
    await db.query(`insert into employer_payment_reversals(stripe_event_id,order_id,product,kind,dispute_id,cumulative_amount_cents,occurred_at)
      values('evt_credit_lost',$1,'credit','dispute_lost','dp_credit_lost',10000,'2026-10-22T01:00:00Z')`, [lostCredit]);
    const lost = (await db.query<{disputes:number;disputed_cents:number;net_collected_cents:number}>(
      "select disputes,disputed_cents,net_collected_cents from commercial_funnel_daily where day='2026-10-22' and product='credit'")).rows[0];
    assert.equal(Number(lost.disputes), 1);
    assert.equal(Number(lost.disputed_cents), 10000);
    assert.equal(Number(lost.net_collected_cents), -10000);
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from commercial_funnel_daily"), /permission denied/);
    await assert.rejects(db.query("select * from employer_contact_handoffs"), /permission denied/);
  } finally { await db.close(); }
});

test("browser analytics rejects financial claims and strips contact data", () => {
  assert.equal(sanitizeAnalytics({ event_name: "checkout_success", metadata: { session_id: session } }), null);
  assert.deepEqual(sanitizeAnalytics({ event_name: "directory_search_submitted", metadata: {
    session_id: session, phone: "18095550100", message: "private", url: "https://wa.me/18095550100", city: "Puerto Plata"
  } }), { event_name: "directory_search_submitted", metadata: { session_id: session } });
});

test("analytics ingestion reports rejected and failed writes to the caller", async () => {
  const names = ["MARKETPLACE_ENABLED", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const before = names.map(name => process.env[name]);
  const fetchBefore = globalThis.fetch;
  process.env.MARKETPLACE_ENABLED = "false";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://analytics-fixture.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture_service";
  const req = (event_name: string) => new Request("https://example.test/api/analytics/events", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_name, metadata: { session_id: session } }) });
  try {
    globalThis.fetch = async () => Response.json({ id: "event" });
    assert.equal((await analyticsPost(req("request_matches"))).status, 204);
    assert.equal((await analyticsPost(req("checkout_success"))).status, 400);
    globalThis.fetch = async () => Response.json({ message: "constraint failed" }, { status: 400 });
    assert.equal((await analyticsPost(req("directory_search_submitted"))).status, 503);
  } finally {
    globalThis.fetch = fetchBefore;
    names.forEach((name, i) => { if (before[i] === undefined) delete process.env[name]; else process.env[name] = before[i]; });
  }
});
