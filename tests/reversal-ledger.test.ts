import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const owner = "11111111-1111-4111-8111-111111111111";
const worker = "22222222-2222-4222-8222-222222222222";
type Reversal = [string, string, string | null, number, number];

test("private PostgreSQL funnel nets cumulative refunds and distinct dispute holds across event orderings", async () => {
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
    await db.exec("set time zone 'America/New_York'");

    const scenario = async (name: string, reversals: Reversal[], expected: {
      net: number; refunded: number; disputed: number; refunds: number; disputes: number;
      daily?: Record<string, [number, number, number]>;
    }) => {
      await db.exec("delete from employer_payment_reversals; delete from employer_direct_contact_orders");
      const order = (await db.query<{ id: string }>(`insert into employer_direct_contact_orders
        (owner_user_id,worker_id,stripe_session_id,status,paid_at,stripe_payment_intent_id,created_at)
        values($1,$2,$3,'paid','2026-10-18T02:00:00Z',$4,'2026-10-18T01:00:00Z') returning id`,
        [owner, worker, `cs_test_${name}`, `pi_${name}`])).rows[0].id;
      for (const [id, kind, disputeId, cents, day] of reversals) {
        await db.query(`insert into employer_payment_reversals
          (stripe_event_id,order_id,product,kind,dispute_id,cumulative_amount_cents,occurred_at)
          values($1,$2,'direct',$3,$4,$5,$6) on conflict (stripe_event_id) do nothing`,
        [id, order, kind, disputeId, cents, `2026-10-${day}T01:00:00Z`]);
      }
      const rows = (await db.query<{day: string | Date; refunded_cents: number; disputed_cents: number;
        net_collected_cents: number; refunds: number; disputes: number}>(
        "select day,refunded_cents,disputed_cents,net_collected_cents,refunds,disputes from commercial_funnel_daily where product='direct' order by day"
      )).rows;
      const total = (key: "refunded_cents" | "disputed_cents" | "net_collected_cents" | "refunds" | "disputes") =>
        rows.reduce((sum, row) => sum + Number(row[key]), 0);
      assert.deepEqual({ net: total("net_collected_cents"), refunded: total("refunded_cents"),
        disputed: total("disputed_cents"), refunds: total("refunds"), disputes: total("disputes") },
      { net: expected.net, refunded: expected.refunded, disputed: expected.disputed,
        refunds: expected.refunds, disputes: expected.disputes }, name);
      for (const [day, expectedAmounts] of Object.entries(expected.daily ?? {})) {
        const row = rows.find(row => (row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day)) === `2026-10-${day}`);
        assert.ok(row, `${name}: missing day ${day}`);
        assert.deepEqual([Number(row.refunded_cents), Number(row.disputed_cents), Number(row.net_collected_cents)], expectedAmounts, `${name}: day ${day}`);
      }
    };

    await scenario("partial", [
      ["evt_partial_2", "refund", null, 8900, 20], // Delivery before the older snapshot.
      ["evt_partial_1", "refund", null, 3000, 19],
      ["evt_partial_1", "refund", null, 3000, 19], // Stripe retry.
      ["evt_partial_duplicate", "refund", null, 8900, 21],
    ], { net: 0, refunded: 8900, disputed: 0, refunds: 2, disputes: 0,
      daily: { "19": [3000, 0, -3000], "20": [5900, 0, -5900], "21": [0, 0, 0] } });
    await scenario("same_second_partials", [
      ["evt_a_large", "refund", null, 8900, 19],
      ["evt_z_small", "refund", null, 3000, 19],
    ], { net: 0, refunded: 8900, disputed: 0, refunds: 2, disputes: 0 });
    await scenario("refund_then_dispute", [
      ["evt_rd_refund", "refund", null, 3000, 19],
      ["evt_rd_open", "dispute_opened", "dp_rd", 5900, 20],
      ["evt_rd_repeat", "dispute_opened", "dp_rd", 5900, 21],
    ], { net: 0, refunded: 3000, disputed: 5900, refunds: 1, disputes: 1 });
    await scenario("dispute_then_refund", [
      ["evt_dr_refund", "refund", null, 3000, 20], // Delivered before the dispute.
      ["evt_dr_open", "dispute_opened", "dp_dr", 5900, 19],
    ], { net: 0, refunded: 3000, disputed: 5900, refunds: 1, disputes: 1,
      daily: { "19": [0, 5900, -5900], "20": [3000, 0, -3000] } });
    await scenario("won_and_reinstated", [
      ["evt_won_release", "dispute_released", "dp_won", 8900, 21], // Delivered first.
      ["evt_won_open", "dispute_opened", "dp_won", 8900, 19],
      ["evt_won_closed", "dispute_won", "dp_won", 8900, 20],
    ], { net: 8900, refunded: 0, disputed: 0, refunds: 0, disputes: 1,
      daily: { "19": [0, 8900, -8900], "20": [0, 0, 0], "21": [0, -8900, 8900] } });
    await scenario("lost", [
      ["evt_lost_open", "dispute_opened", "dp_lost", 8900, 19],
      ["evt_lost_closed", "dispute_lost", "dp_lost", 8900, 20],
    ], { net: 0, refunded: 0, disputed: 8900, refunds: 0, disputes: 1 });
    await scenario("refunded_dispute_reinstated", [
      ["evt_mix_open", "dispute_opened", "dp_mix", 8900, 19],
      ["evt_mix_refund", "refund", null, 3000, 20],
      ["evt_mix_release", "dispute_released", "dp_mix", 8900, 21],
    ], { net: 5900, refunded: 3000, disputed: 0, refunds: 1, disputes: 1,
      daily: { "20": [3000, -3000, 0], "21": [0, -5900, 5900] } });
    await scenario("fully_refunded_then_disputed", [
      ["evt_full_refund", "refund", null, 8900, 19],
      ["evt_full_dispute", "dispute_opened", "dp_full", 8900, 20],
    ], { net: 0, refunded: 8900, disputed: 0, refunds: 1, disputes: 1 });
    await scenario("two_disputes", [
      ["evt_two_first", "dispute_opened", "dp_first", 3000, 19],
      ["evt_two_second", "dispute_opened", "dp_second", 5900, 20],
      ["evt_two_release", "dispute_released", "dp_first", 3000, 21],
    ], { net: 3000, refunded: 0, disputed: 5900, refunds: 0, disputes: 2 });

    await assert.rejects(db.query(`insert into employer_payment_reversals
      (stripe_event_id,order_id,product,kind,dispute_id,cumulative_amount_cents,occurred_at)
      values('evt_invalid',$1,'direct','dispute_opened',null,8900,'2026-10-22T01:00:00Z')`,
      [(await db.query<{id:string}>("select id from employer_direct_contact_orders limit 1")).rows[0].id]),
    /employer_payment_reversals_dispute_id_check/);
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from commercial_funnel_daily"), /permission denied/);
    await assert.rejects(db.query("select * from employer_payment_reversals"), /permission denied/);
  } finally { await db.close(); }
});
