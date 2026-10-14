import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const id = "22222222-2222-4222-8222-222222222222";
const owner = "33333333-3333-4333-8333-333333333333";
const publicColumns = "id,full_name,city,work_style,desired_income,short_intro,skills,photo_url,created_at,available_now,rating_average,rating_count,hired_count,experience,income_type,last_boosted_at,boost_expires_at,is_verified";

test("privacy candidate on isolated PostgreSQL: leaky policies/column grants contained, public queries and privileged renewal preserved", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to public;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table workers(id uuid primary key, user_id uuid, edit_token text, whatsapp_number text,
        full_name text, city text, work_style text, desired_income numeric, short_intro text, skills text[], photo_url text,
        created_at timestamptz default now(), available_now boolean default false, rating_average numeric,
        rating_count integer, hired_count integer, experience text, income_type text,
        last_boosted_at timestamptz, boost_expires_at timestamptz, is_verified boolean);
      create table contact_requests(id integer, worker_id uuid references workers);
      alter table workers enable row level security; alter table contact_requests enable row level security;
      grant all on workers,contact_requests to anon,authenticated,service_role;
      grant select(edit_token),update(whatsapp_number) on workers to public;
      create policy leaky_legacy on workers for all using(true) with check(true);
      create policy "Workers view requests for themselves" on contact_requests for select using(exists(select 1 from workers where workers.id=worker_id and user_id=auth.uid()));
      insert into workers(id,user_id,edit_token,whatsapp_number,full_name,photo_url,is_verified)
        values('${id}','${owner}','preserved-token','private-phone','Approved','original-photo',true),
        ('44444444-4444-4444-8444-444444444444',null,'other-token','other-phone','Unapproved','other-photo',false);
      insert into contact_requests values(1,'${id}');`);
    const before = (await db.query("select * from workers order by id")).rows;
    // Demonstrate fixture has the same classes of exposure as the prior live HEAD audit.
    await db.exec("set role anon");
    assert.equal((await db.query("select edit_token from workers")).rows.length, 2);
    await db.exec("reset role");
    const privacySql = await readFile(new URL("../supabase/migrations/202610081600_worker_public_privacy.sql", import.meta.url), "utf8");
    await db.exec("create role legacy_reader; grant legacy_reader to anon; grant select(edit_token) on workers to legacy_reader");
    await assert.rejects(db.exec(privacySql), /inherited private-column access/);
    await db.exec("rollback; revoke select(edit_token) on workers from legacy_reader");
    assert.deepEqual((await db.query("select * from workers order by id")).rows, before, "failed migration rolls back without data change");
    await db.exec("grant update(worker_id) on contact_requests to legacy_reader");
    await assert.rejects(db.exec(privacySql), /inherited contact write access/);
    await db.exec("rollback; revoke update(worker_id) on contact_requests from legacy_reader");
    await db.exec(privacySql);
    await db.exec(await readFile(new URL("../supabase/migrations/202610081400_worker_availability.sql", import.meta.url), "utf8"));
    assert.deepEqual((await db.query("select * from workers order by id")).rows, before);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      const rows = (await db.query<{photo_url: string}>(`select ${publicColumns} from workers where is_verified=true`)).rows;
      assert.equal(rows.length, 1); assert.equal(rows[0].photo_url, "original-photo");
      assert.equal((await db.query("select id from workers")).rows.length, 1, "RLS works without app approval filter");
      assert.equal((await db.query("select id from workers where is_verified=false")).rows.length, 0);
      assert.equal((await db.query("select id from workers where is_verified and available_now and created_at > now()-interval '30 days'")).rows.length, 0);
      for (const sql of ["select * from workers", "select edit_token from workers", "select whatsapp_number from workers", "select user_id from workers", "select id from workers where edit_token='guess'", "select id from workers order by whatsapp_number", "update workers set available_now=true", "delete from workers", "insert into workers(id) values(gen_random_uuid())", "select token_hash from worker_availability"]) {
        await assert.rejects(db.query(sql), /permission denied/, sql);
      }
      for (const sql of ["update contact_requests set worker_id=worker_id", "delete from contact_requests", "insert into contact_requests values(2,null)"]) {
        await assert.rejects(db.query(sql), /permission denied/, sql);
      }
      await db.exec("reset role");
    }
    await db.exec(await readFile(new URL("../supabase/migrations/202610131400_worker_contact_preview_privacy.sql", import.meta.url), "utf8"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      assert.equal((await db.query("select id from workers where is_verified=true")).rows.length, 1);
      for (const column of ["full_name", "city", "short_intro", "skills", "experience", "photo_url", "whatsapp_number"]) {
        await assert.rejects(db.query(`select ${column} from workers`), /permission denied/);
      }
      await db.exec("reset role");
    }
    await db.exec("set role anon");
    assert.equal((await db.query("select * from contact_requests")).rows.length,0);
    await assert.rejects(db.query("select owns_worker_profile($1)",[id]),/permission denied/);
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
    assert.equal((await db.query("select * from contact_requests")).rows.length,1,"owner can read own contacts without exposing user_id");
    await assert.rejects(db.query("update contact_requests set worker_id=worker_id"), /permission denied/, "ownership does not authorize forging both participant answers");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    assert.equal((await db.query("select * from contact_requests")).rows.length,0);
    await db.exec("reset role; set role service_role");
    assert.equal((await db.query("select whatsapp_number from workers where is_verified")).rows.length,1,"server free contact still has phone access");
    await db.query("update workers set full_name=full_name where id=$1",[id]);
    await db.query("select issue_worker_availability($1,$2)",[id,"a".repeat(64)]);
    assert.equal((await db.query<{available_now: boolean}>("select available_now from workers where id=$1",[id])).rows[0].available_now,false,"issuance never activates worker");
    await db.query("select * from renew_worker_availability($1,true)",["a".repeat(64)]);
    assert.equal((await db.query<{available_now: boolean}>("select available_now from workers where id=$1",[id])).rows[0].available_now,true);
    await db.query("select * from renew_worker_availability($1,false)",["a".repeat(64)]);
    assert.equal((await db.query<{available_now: boolean}>("select available_now from workers where id=$1",[id])).rows[0].available_now,false);
  } finally { await db.close(); }
});
