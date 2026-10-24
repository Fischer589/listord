import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  selected: "11111111-1111-4111-8111-111111111111",
  other: "22222222-2222-4222-8222-222222222222",
  approved: "33333333-3333-4333-8333-333333333333",
  financial: "44444444-4444-4444-8444-444444444444",
  activity: "55555555-5555-4555-8555-555555555555",
  cascading: "66666666-6666-4666-8666-666666666666",
  linked: "77777777-7777-4777-8777-777777777777",
  failure: "88888888-8888-4888-8888-888888888888",
  futureReference: "99999999-9999-4999-8999-999999999999"
};

test("pending worker deletion is atomic, exhaustive over FKs, and preserves protected history", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.workers(id uuid primary key, full_name text, is_verified boolean not null default false,
        user_id uuid, owner_user_id uuid);
      create table public.worker_activation_queue(
        worker_id uuid primary key references public.workers(id) on delete restrict,
        invitation_permission_at timestamptz, invitation_evidence text, invitation_channel text,
        suppressed_at timestamptz, suppression_reason text, opted_out_at timestamptz,
        unreachable_at timestamptz, created_at timestamptz default now());
      create table public.worker_boosts(worker_id uuid references public.workers(id) on delete cascade, amount integer);
      create table public.contact_attempts(worker_id uuid references public.workers(id) on delete cascade);
      create table public.employer_direct_contact_orders(worker_id uuid references public.workers(id) on delete restrict, amount integer);
      create table public.employer_requests(id integer primary key, description text);
      insert into public.workers(id,full_name,is_verified,owner_user_id) values
        ('${ids.selected}','Selected',false,null), ('${ids.other}','Other',false,null),
        ('${ids.approved}','Approved',true,null), ('${ids.financial}','Paid',false,null),
        ('${ids.activity}','Invited',false,null), ('${ids.cascading}','Contacted',false,null),
        ('${ids.linked}','Linked',false,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
        ('${ids.failure}','Failure',false,null), ('${ids.futureReference}','Future reference',false,null);
      insert into public.worker_activation_queue(worker_id)
        select id from public.workers;
      update public.worker_activation_queue set invitation_permission_at=now(),
        invitation_evidence='permission-evidence',invitation_channel='whatsapp'
        where worker_id='${ids.activity}';
      insert into public.worker_boosts values ('${ids.financial}',10000);
      insert into public.employer_direct_contact_orders values ('${ids.financial}',8900);
      insert into public.contact_attempts values ('${ids.cascading}');
      insert into public.employer_requests values (1,'Preserved request');
    `);
    const migration = await readFile(new URL("../supabase/migrations/20261024210535_pending_worker_rejection.sql", import.meta.url), "utf8");
    await db.exec(migration);
    // A table introduced after the function must also be discovered at call time.
    await db.exec(`create table public.future_worker_history(worker_id uuid references public.workers(id) on delete cascade);
      insert into public.future_worker_history values ('${ids.futureReference}');`);

    const remove = async (id: string) => {
      const result = await db.query<{ result: string }>("select public.admin_delete_pending_worker($1) as result", [id]);
      return result.rows[0].result;
    };
    assert.equal(await remove(ids.approved), "not_pending");
    for (const id of [ids.financial, ids.activity, ids.cascading, ids.linked, ids.futureReference]) {
      assert.equal(await remove(id), "protected");
      assert.equal((await db.query("select id from public.workers where id=$1", [id])).rows.length, 1);
      assert.equal((await db.query("select worker_id from public.worker_activation_queue where worker_id=$1", [id])).rows.length, 1);
    }
    assert.deepEqual((await db.query("select amount from public.worker_boosts where worker_id=$1", [ids.financial])).rows, [{ amount: 10000 }]);
    assert.deepEqual((await db.query("select amount from public.employer_direct_contact_orders where worker_id=$1", [ids.financial])).rows, [{ amount: 8900 }]);
    assert.equal((await db.query("select worker_id from public.contact_attempts where worker_id=$1", [ids.cascading])).rows.length, 1);
    assert.equal((await db.query("select worker_id from public.future_worker_history where worker_id=$1", [ids.futureReference])).rows.length, 1);

    await db.exec(`create function public.fail_selected_delete() returns trigger language plpgsql as $$
      begin if old.id='${ids.failure}' then raise exception 'injected worker deletion failure'; end if;
      return old; end $$;
      create trigger fail_selected_delete before delete on public.workers
        for each row execute function public.fail_selected_delete();`);
    await assert.rejects(remove(ids.failure), /injected worker deletion failure/);
    assert.equal((await db.query("select id from public.workers where id=$1", [ids.failure])).rows.length, 1);
    assert.equal((await db.query("select worker_id from public.worker_activation_queue where worker_id=$1", [ids.failure])).rows.length, 1);

    assert.equal(await remove(ids.selected), "deleted");
    assert.equal((await db.query("select id from public.workers where id=$1", [ids.selected])).rows.length, 0);
    assert.equal((await db.query("select worker_id from public.worker_activation_queue where worker_id=$1", [ids.selected])).rows.length, 0);
    assert.equal(await remove(ids.selected), "not_pending");
    assert.equal((await db.query("select id from public.workers where id=$1", [ids.other])).rows.length, 1);
    assert.deepEqual((await db.query("select description from public.employer_requests")).rows, [{ description: "Preserved request" }]);
    assert.equal((await db.query<{ n: number }>("select count(*)::integer n from public.workers")).rows[0].n, 8);
    assert.equal((await db.query<{ n: number }>("select count(*)::integer n from public.worker_activation_queue")).rows[0].n, 8);

    const grants = await db.query<{ anon: boolean; authenticated: boolean; service: boolean }>(`
      select has_function_privilege('anon','public.admin_delete_pending_worker(uuid)','execute') as anon,
        has_function_privilege('authenticated','public.admin_delete_pending_worker(uuid)','execute') as authenticated,
        has_function_privilege('service_role','public.admin_delete_pending_worker(uuid)','execute') as service`);
    assert.deepEqual(grants.rows, [{ anon: false, authenticated: false, service: true }]);
    await db.exec("set role anon");
    await assert.rejects(remove(ids.other), /permission denied/);
  } finally {
    await db.close();
  }
});
