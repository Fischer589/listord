import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const owner = "11111111-1111-4111-8111-111111111111";

test("admin soft deletion closes every status, rejects repeats, keeps paid history, and blocks featured reserve", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.workers(id uuid primary key, full_name text);
      insert into auth.users values ('${owner}');`);
    for (const file of ["202610071200_marketplace_foundation.sql", "202610131200_marketplace_featured.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.exec("create table public.marketplace_events(id bigint generated always as identity primary key, opportunity_id uuid references public.marketplace_opportunities(id), kind text not null); grant select on public.marketplace_events to service_role");
    await db.exec(await readFile(new URL("../supabase/migrations/202610131300_marketplace_soft_delete.sql", import.meta.url), "utf8"));
    const row = await db.query<{ id: string }>(`insert into marketplace_opportunities
      (category,city,scope,compensation_kind,expires_at,status,moderation_status,published_at,timing_note,duration_note)
      values ('limpieza','Santo Domingo','Limpieza de oficina semanal','negotiable',now()+interval '30 days','draft','approved',now(),'Flexible','Una semana') returning id`);
    const id = row.rows[0].id;
    await db.query(`insert into marketplace_opportunity_owners
      (opportunity_id,owner_user_id,idempotency_key,contact_name,whatsapp_number,publication_consent_at)
      values($1,$2,'33333333-3333-4333-8333-333333333333','Employer','18091234567',now())`, [id, owner]);
    await db.query("update marketplace_opportunities set status='open' where id=$1", [id]);
    const order = (await db.query<{ marketplace_featured_reserve: string }>("select marketplace_featured_reserve($1,$2)", [owner, id])).rows[0].marketplace_featured_reserve;
    await db.query("update marketplace_featured_orders set status='failed' where id=$1", [order]);
    await db.query(`insert into marketplace_featured_orders(opportunity_id,owner_user_id,status,paid_at,featured_until,stripe_session_id)
      values($1,$2,'paid',now(),now()+interval '7 days','cs_test_preserved')`, [id, owner]);
    await db.exec("set role anon");
    await assert.rejects(db.query("select marketplace_soft_delete($1)", [id]), /permission denied/);
    await db.exec("reset role; set role service_role");
    assert.equal((await db.query<{marketplace_soft_delete: boolean}>("select marketplace_soft_delete($1)", [id])).rows[0].marketplace_soft_delete, true);
    assert.equal((await db.query<{marketplace_soft_delete: boolean}>("select marketplace_soft_delete($1)", [id])).rows[0].marketplace_soft_delete, false);
    await assert.rejects(db.query("select marketplace_featured_reserve($1,$2)", [owner, id]), /NOT_ELIGIBLE/);
    await assert.rejects(db.query("update marketplace_opportunities set status='open' where id=$1", [id]), /ALREADY_DELETED/);
    const state = (await db.query<{ status: string; deleted_at: Date }>("select status,deleted_at from marketplace_opportunities where id=$1", [id])).rows[0];
    assert.equal(state.status, "closed");
    assert.ok(state.deleted_at);
    assert.equal((await db.query("select id from marketplace_featured_orders where opportunity_id=$1 and status='paid'", [id])).rows.length, 1);
    assert.equal((await db.query<{ kind: string }>("select kind from marketplace_events where opportunity_id=$1", [id])).rows[0].kind, "admin_deleted");
    for (const status of ["draft", "closed", "filled", "expired"]) {
      const created = await db.query<{id: string}>(`insert into marketplace_opportunities
        (category,city,scope,compensation_kind,expires_at,status,moderation_status,timing_note,duration_note)
        values ('limpieza','Santo Domingo','Limpieza de oficina semanal','negotiable',now()+interval '30 days',$1,'rejected','Flexible','Una semana') returning id`, [status]);
      const another = created.rows[0].id;
      assert.equal((await db.query<{marketplace_soft_delete: boolean}>("select marketplace_soft_delete($1)", [another])).rows[0].marketplace_soft_delete, true);
      assert.equal((await db.query<{status: string}>("select status from marketplace_opportunities where id=$1", [another])).rows[0].status, "closed");
    }
    await db.exec("reset role; set role anon");
    assert.equal((await db.query("select id from marketplace_opportunities where id=$1", [id])).rows.length, 0);
  } finally { await db.close(); }
});
