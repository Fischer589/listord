import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("owner identity migration refuses public worker grants and leaves historical owners unset", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.workers(id uuid primary key, edit_token text, is_verified boolean);
      alter table public.workers enable row level security;
      grant select on public.workers to anon, authenticated;
      grant all on public.workers to service_role;
      insert into public.workers values('22222222-2222-4222-8222-222222222222','preserved-token',true);`);
    const candidate = await readFile(new URL("../supabase/migrations/202610081700_worker_owner_identity.sql", import.meta.url), "utf8");
    await assert.rejects(db.exec(candidate), /worker privacy repair required/);
    await db.exec(`rollback;
      revoke select on public.workers from anon, authenticated;
      grant select(id,is_verified) on public.workers to anon, authenticated;
      create policy workers_approved_public_guard on public.workers as restrictive
        for select to anon,authenticated using(is_verified is true);
      create policy workers_approved_public_read on public.workers
        for select to anon,authenticated using(is_verified is true);
      insert into auth.users values('33333333-3333-4333-8333-333333333333');`);
    await db.exec(candidate);
    assert.deepEqual((await db.query<{owner_user_id: string | null}>("select owner_user_id from public.workers")).rows,
      [{ owner_user_id: null }]);
    await db.exec("set role anon");
    assert.equal((await db.query("select id from public.workers")).rows.length, 1);
    await assert.rejects(db.query("select owner_user_id from public.workers"), /permission denied/);
    await db.exec("reset role; set role service_role");
    await db.query("update public.workers set owner_user_id=$1", ["33333333-3333-4333-8333-333333333333"]);
    await db.exec("reset role; set role anon");
    assert.equal((await db.query("select id from public.workers")).rows.length, 1);
    await assert.rejects(db.query("select owner_user_id from public.workers"), /permission denied/);
  } finally {
    await db.close();
  }
});
