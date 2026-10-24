import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("rejecting one pending worker preserves linked profiles and financial history", async () => {
  const db = new PGlite();
  const selected = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const approved = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table workers(id uuid primary key, full_name text, is_verified boolean not null default false);
      create table worker_activation_queue(worker_id uuid primary key references workers(id) on delete restrict);
      create table worker_boosts(worker_id uuid references workers(id) on delete cascade, amount integer);
      create table employer_requests(id integer primary key, description text);
      insert into workers values
        ('${selected}','Selected pending',false),
        ('${other}','Other pending',false),
        ('${approved}','Approved',true);
      insert into worker_activation_queue values ('${selected}'),('${other}'),('${approved}');
      insert into worker_boosts values ('${selected}',10000);
      insert into employer_requests values (1,'Preserved request');
      grant select(id) on workers to anon;
    `);
    const migration = await readFile(new URL("../supabase/migrations/20261024210535_pending_worker_rejection.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await assert.rejects(db.query("delete from workers where id=$1", [selected]), /foreign key constraint/);
    const changed = await db.query<{ id: string }>(
      "update workers set rejected_at=now() where id=$1 and is_verified=false and rejected_at is null returning id", [selected]);
    assert.deepEqual(changed.rows, [{ id: selected }]);
    assert.equal((await db.query("update workers set rejected_at=now() where id=$1 and is_verified=false and rejected_at is null returning id", [selected])).rows.length, 0);
    assert.equal((await db.query("update workers set rejected_at=now() where id=$1 and is_verified=false and rejected_at is null returning id", [approved])).rows.length, 0);
    assert.deepEqual((await db.query("select id from workers where rejected_at is null order by id")).rows, [{ id: other }, { id: approved }]);
    assert.equal((await db.query<{ n: number }>("select count(*)::integer n from workers")).rows[0].n, 3);
    assert.equal((await db.query<{ n: number }>("select count(*)::integer n from worker_activation_queue")).rows[0].n, 3);
    assert.deepEqual((await db.query("select amount from worker_boosts where worker_id=$1", [selected])).rows, [{ amount: 10000 }]);
    assert.deepEqual((await db.query("select description from employer_requests")).rows, [{ description: "Preserved request" }]);
    await assert.rejects(db.query("update workers set is_verified=true where id=$1", [selected]), /check constraint/);
    await db.exec("set role anon");
    await assert.rejects(db.query("select rejected_at from workers"), /permission denied/);
    await assert.rejects(db.query("update workers set rejected_at=now()"), /permission denied/);
  } finally {
    await db.close();
  }
});
