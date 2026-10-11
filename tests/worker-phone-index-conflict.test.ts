import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("ingestion budget preserves shared phones and permits a distinct new worker", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table public.workers(id integer primary key, whatsapp_number text);
      insert into public.workers values (1,'18090000111'),(2,'8090000111');`);
    const budget = await readFile(new URL("../supabase/migrations/202610101200_ingestion_budget.sql", import.meta.url), "utf8");
    await db.exec(budget);
    const lookupIndex = await readFile(new URL("../supabase/migrations/202604271400_add_worker_phone_quality_guards.sql", import.meta.url), "utf8");
    await db.exec(lookupIndex);
    const before = (await db.query("select * from public.workers order by id")).rows;
    await db.exec("insert into public.workers values (3,'+18090000111')");
    assert.deepEqual((await db.query("select id from public.workers order by id")).rows, [{ id: 1 }, { id: 2 }, { id: 3 }]);
    assert.deepEqual((await db.query("select * from public.workers where id in (1,2) order by id")).rows, before);
    assert.equal((await db.query<{n: number}>("select count(*)::integer n from public.marketplace_ingestion_limits")).rows[0].n, 0);
    assert.equal((await db.query<{is_unique: boolean}>("select indisunique as is_unique from pg_index where indexrelid='public.workers_whatsapp_digits_idx'::regclass")).rows[0].is_unique, false);
  } finally { await db.close(); }
});
