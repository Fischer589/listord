import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("additive marketplace migration preserves legacy data and enforces privacy/constraints", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.workers(id uuid primary key, full_name text, photo_url text);
      create table public.employer_requests(id uuid primary key, description text);
      create table public.worker_boosts(id uuid primary key, amount integer);
      insert into auth.users values ('11111111-1111-4111-8111-111111111111');
      insert into public.workers values ('22222222-2222-4222-8222-222222222222', 'Preserved worker', 'https://original.example/photo.jpg');
      insert into public.employer_requests values ('33333333-3333-4333-8333-333333333333', 'Private legacy lead');
      insert into public.worker_boosts values ('44444444-4444-4444-8444-444444444444', 10000);
    `);
    const before = await db.query("select * from workers");
    const migration = await readFile(new URL("../supabase/migrations/202610071200_marketplace_foundation.sql", import.meta.url), "utf8");
    await db.exec(migration);
    assert.deepEqual((await db.query("select * from workers")).rows, before.rows);
    assert.equal((await db.query("select * from employer_requests")).rows.length, 1);
    assert.deepEqual((await db.query("select amount from worker_boosts")).rows, [{ amount: 10000 }]);
    assert.equal((await db.query("select * from marketplace_opportunities")).rows.length, 0, "no automatic lead publication");

    const insert = `insert into marketplace_opportunities (category, city, scope, compensation_kind, expires_at, created_at, status, moderation_status, published_at, timing_note, duration_note)
      values ('limpieza', 'Puerto Plata', 'Limpiar pisos y baños', 'negotiable', $1, $2, $3, $4, $5, 'Horario por acordar', 'Duración por acordar') returning id`;
    const now = new Date();
    const future = new Date(now.getTime() + 86400000);
    const old = new Date(now.getTime() - 2 * 86400000);
    const yesterday = new Date(now.getTime() - 86400000);
    const open = await db.query<{ id: string }>(insert, [future, now, "draft", "approved", now]);
    const id = open.rows[0].id;
    await assert.rejects(db.query("update marketplace_opportunities set status='open' where id=$1", [id]), /publication consent/);
    await db.query(`insert into marketplace_opportunity_owners(opportunity_id, owner_user_id, idempotency_key, contact_name, whatsapp_number, publication_consent_at)
      values ($1, '11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 'Private employer', '18091234567', now())`, [id]);
    await db.query("update marketplace_opportunities set status='open' where id=$1", [id]);
    await db.query(insert, [future, now, "draft", "pending", null]);
    const expired = await db.query<{ id: string }>(insert, [yesterday, old, "draft", "approved", old]);
    await db.query(`insert into marketplace_opportunity_owners(opportunity_id, owner_user_id, idempotency_key, contact_name, whatsapp_number, publication_consent_at)
      values ($1, '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 'Private employer', '18091234567', now())`, [expired.rows[0].id]);
    await db.query("update marketplace_opportunities set status='open' where id=$1", [expired.rows[0].id]);
    await db.query(insert, [future, now, "closed", "approved", now]);
    await assert.rejects(db.query("update marketplace_opportunities set moderation_status='pending' where id=$1", [id]), /check constraint/);
    await db.exec("set role anon");
    assert.deepEqual((await db.query("select id from marketplace_opportunities")).rows, [{ id }]);
    await assert.rejects(db.query("select * from marketplace_opportunity_owners"), /permission denied/);
    await assert.rejects(db.query("select * from marketplace_interests"), /permission denied/);
    await assert.rejects(db.query("select * from marketplace_reports"), /permission denied/);
    await assert.rejects(db.query("update marketplace_opportunities set status='filled'"), /permission denied/);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(db.query("select * from marketplace_opportunity_owners"), /permission denied/);
    await assert.rejects(db.query("delete from marketplace_opportunities"), /permission denied/);
    await db.exec("reset role");

    await assert.rejects(db.query("update marketplace_opportunities set compensation_kind='fixed' where id=$1", [id]), /check constraint/);
    await assert.rejects(db.query("update marketplace_opportunities set specification='[]' where id=$1", [id]), /check constraint/);
    await assert.rejects(db.query("update marketplace_opportunities set schema_version=2 where id=$1", [id]), /check constraint/);
    await db.query("insert into marketplace_interests(opportunity_id, worker_id, decision) values ($1, '22222222-2222-4222-8222-222222222222', 'interested')", [id]);
    await assert.rejects(db.query("insert into marketplace_interests(opportunity_id, worker_id, decision) values ($1, '22222222-2222-4222-8222-222222222222', 'interested')", [id]), /unique constraint/);
    await assert.rejects(db.query("delete from workers"), /foreign key constraint/);
    await db.query("update marketplace_opportunities set status='filled' where id=$1", [id]);
    await assert.rejects(db.query("update marketplace_interests set decision='interested' where opportunity_id=$1", [id]), /not open/);
    await assert.rejects(db.query("insert into marketplace_interests(opportunity_id, worker_id, decision) values ($1, '22222222-2222-4222-8222-222222222222', 'interested')", [expired.rows[0].id]), /not open/);
    await db.query("update marketplace_interests set decision='withdrawn' where opportunity_id=$1", [id]);
  } finally {
    await db.close();
  }
});
