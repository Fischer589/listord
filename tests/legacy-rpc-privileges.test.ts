import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("legacy privileged RPC repair denies both client roles and preserves server execution", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create function public.activate_worker_boost(uuid,text,integer,text)
        returns boolean language sql security definer as $$ select true $$;
      create function public.claim_worker_contact(text,uuid)
        returns boolean language sql security definer as $$ select true $$;
      grant execute on function public.activate_worker_boost(uuid,text,integer,text),
        public.claim_worker_contact(text,uuid) to anon,authenticated;`);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      assert.equal((await db.query<{ allowed: boolean }>("select public.activate_worker_boost(null,null,null,null) as allowed")).rows[0].allowed, true);
      await db.exec("reset role");
    }

    const repair = await readFile(new URL("../supabase/migrations/202610101300_restrict_legacy_rpc_execution.sql", import.meta.url), "utf8");
    await db.exec(repair);
    await db.exec(repair);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select public.activate_worker_boost(null,null,null,null)"), /permission denied/);
      await assert.rejects(db.query("select public.claim_worker_contact(null,null)"), /permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.equal((await db.query<{ allowed: boolean }>("select public.activate_worker_boost(null,null,null,null) as allowed")).rows[0].allowed, true);
    assert.equal((await db.query<{ allowed: boolean }>("select public.claim_worker_contact(null,null) as allowed")).rows[0].allowed, true);
  } finally {
    await db.close();
  }
});
