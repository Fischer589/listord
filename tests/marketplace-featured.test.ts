import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { FEATURED_AMOUNT_CENTS, featuredCheckoutReady, featuredSessionExpiresAt } from "../lib/marketplace-featured";

const owner = "11111111-1111-4111-8111-111111111111";
const stranger = "22222222-2222-4222-8222-222222222222";
const session = "cs_test_featured";
const intent = "pi_featured";

test("featured migration keeps orders private; only eligible owner can reserve; paid placement expires and refunds revoke", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.workers(id uuid primary key, full_name text);
      insert into auth.users values ('${owner}'), ('${stranger}');`);
    for (const file of ["202610071200_marketplace_foundation.sql", "202610131200_marketplace_featured.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    const created = await db.query<{id: string}>(`insert into marketplace_opportunities
      (category,city,scope,compensation_kind,expires_at,status,moderation_status,published_at,timing_note,duration_note)
      values ('limpieza','Santo Domingo','Limpieza de oficina semanal','negotiable',now()+interval '30 days','draft','approved',now(),'Flexible','Una semana') returning id`);
    const id = created.rows[0].id;
    await assert.rejects(db.query("select marketplace_featured_reserve($1,$2)", [owner, id]), /NOT_ELIGIBLE/);
    await db.query(`insert into marketplace_opportunity_owners
      (opportunity_id,owner_user_id,idempotency_key,contact_name,whatsapp_number,publication_consent_at)
      values($1,$2,'33333333-3333-4333-8333-333333333333','Employer','18091234567',now())`, [id, owner]);
    await db.query("update marketplace_opportunities set status='open' where id=$1", [id]);
    await assert.rejects(db.query("select marketplace_featured_reserve($1,$2)", [stranger, id]), /NOT_ELIGIBLE/);
    const order = (await db.query<{marketplace_featured_reserve: string}>("select marketplace_featured_reserve($1,$2)", [owner, id])).rows[0].marketplace_featured_reserve;
    assert.equal((await db.query<{marketplace_featured_reserve: string}>("select marketplace_featured_reserve($1,$2)", [owner, id])).rows[0].marketplace_featured_reserve, order);
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from marketplace_featured_orders"), /permission denied/);
    await assert.rejects(db.query("select marketplace_featured_paid($1,$2,$3,$4,now())", [order, session, intent, "evt_paid"]), /permission denied/);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(db.query("select marketplace_featured_reserve($1,$2)", [owner, id]), /permission denied/);
    await db.exec("reset role");
    await assert.rejects(db.query("select marketplace_featured_paid($1,$2,$3,$4,now())", [order, session, intent, "evt_paid"]), /ORDER_BINDING_REQUIRED/);
    await db.query("update marketplace_featured_orders set stripe_session_id=$1 where id=$2", [session, order]);
    const paidAt = new Date("2026-10-13T12:00:00Z");
    assert.equal((await db.query<{marketplace_featured_paid: string}>("select marketplace_featured_paid($1,$2,$3,$4,$5)", [order, session, intent, "evt_paid", paidAt])).rows[0].marketplace_featured_paid, "activated");
    const row = (await db.query<{featured_until: Date; amount: number; status: string}>("select featured_until,amount,status from marketplace_featured_orders where id=$1", [order])).rows[0];
    assert.equal(row.amount, FEATURED_AMOUNT_CENTS);
    assert.equal(row.status, "paid");
    assert.equal(new Date(row.featured_until).toISOString(), "2026-10-20T12:00:00.000Z");
    assert.equal((await db.query<{marketplace_featured_paid: string}>("select marketplace_featured_paid($1,$2,$3,$4,$5)", [order, session, intent, "evt_duplicate", new Date("2026-10-14T12:00:00Z")])).rows[0].marketplace_featured_paid, "already_paid");
    await db.query("select marketplace_featured_fail($1,$2)", [order, session]);
    assert.equal((await db.query<{status: string}>("select status from marketplace_featured_orders where id=$1", [order])).rows[0].status, "paid");
    await db.query("select marketplace_featured_refund($1,$2,$3,$4)", [order, session, intent, "evt_refund"]);
    await db.query("select marketplace_featured_refund($1,$2,$3,$4)", [order, session, intent, "evt_refund"]);
    assert.equal((await db.query<{status:string; featured_until: Date|null}>("select status,featured_until from marketplace_featured_orders where id=$1", [order])).rows[0].status, "refunded");
    assert.equal((await db.query<{marketplace_featured_paid: string}>("select marketplace_featured_paid($1,$2,$3,$4,$5)", [order, session, intent, "evt_late", paidAt])).rows[0].marketplace_featured_paid, "refunded");
    await db.query("update marketplace_opportunities set status='closed' where id=$1", [id]);
    await assert.rejects(db.query("select marketplace_featured_reserve($1,$2)", [owner, id]), /NOT_ELIGIBLE/);
    await db.query("update marketplace_opportunities set status='open', expires_at=now()+interval '6 days' where id=$1", [id]);
    await assert.rejects(db.query("select marketplace_featured_reserve($1,$2)", [owner, id]), /NOT_ELIGIBLE/);
  } finally { await db.close(); }
});

test("featured Checkout closes before the listing can no longer deliver seven days", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");
  const future = (minutes: number) => new Date(now + 7 * 86400_000 + minutes * 60_000).toISOString();
  assert.equal(featuredSessionExpiresAt(future(31), now), null);
  assert.equal(featuredSessionExpiresAt(future(32), now), null);
  assert.equal(featuredSessionExpiresAt(future(33), now), Math.floor(now / 1000) + 31 * 60);
  assert.equal(featuredSessionExpiresAt(future(40), now), Math.floor(now / 1000) + 38 * 60);
  assert.equal(featuredSessionExpiresAt(future(120), now), Math.floor(now / 1000) + 45 * 60);
});

test("featured checkout stays off without an explicit gate and rejects test keys on the production host", () => {
  const names = ["FEATURED_OPPORTUNITIES_ENABLED", "FEATURED_CHECKOUT_ENABLED", "FEATURED_LIVE_PAYMENTS_ENABLED", "STRIPE_SECRET_KEY", "APP_ORIGIN"];
  const old = names.map(name => process.env[name]);
  try {
    Object.assign(process.env, { FEATURED_OPPORTUNITIES_ENABLED: "true", FEATURED_CHECKOUT_ENABLED: "false", STRIPE_SECRET_KEY: "sk_test_fixture", APP_ORIGIN: "https://release-candidate--listord-2.netlify.app" });
    assert.equal(featuredCheckoutReady("https://release-candidate--listord-2.netlify.app/api/stripe/featured-opportunity-checkout"), false);
    process.env.FEATURED_CHECKOUT_ENABLED = "true";
    assert.equal(featuredCheckoutReady("https://release-candidate--listord-2.netlify.app/api/stripe/featured-opportunity-checkout"), true);
    assert.equal(featuredCheckoutReady("https://listordapp.com/api/stripe/featured-opportunity-checkout"), false);
    process.env.STRIPE_SECRET_KEY = "sk_live_fixture";
    assert.equal(featuredCheckoutReady("https://release-candidate--listord-2.netlify.app/api/stripe/featured-opportunity-checkout"), false);
  } finally { names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]; }); }
});
