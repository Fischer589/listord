import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { ACTIVATION_INVITATION, buildActivationQueue, type CampaignWorker } from "../lib/activation-campaign";

const owner = "11111111-1111-4111-8111-111111111111";
const first = "22222222-2222-4222-8222-222222222222";
const second = "33333333-3333-4333-8333-333333333333";
const third = "44444444-4444-4444-8444-444444444444";

test("campaign inventory includes every profile, suppresses shared phones and keeps consent separate", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const workers: CampaignWorker[] = [
    { id: first, is_verified: true, owner_user_id: owner, whatsapp_number: "8095550100", available_now: true },
    { id: second, is_verified: true, owner_user_id: null, whatsapp_number: "+18095550100", available_now: false },
    { id: third, is_verified: false, owner_user_id: null, whatsapp_number: null, available_now: false }
  ];
  const report = buildActivationQueue(workers, [
    { worker_id: first, invitation_permission_at: now.toISOString(), invitation_channel: "whatsapp", suppressed_at: null, opted_out_at: null, unreachable_at: null },
    { worker_id: second, invitation_permission_at: null, invitation_channel: null, suppressed_at: null, opted_out_at: null, unreachable_at: null },
    { worker_id: third, invitation_permission_at: null, invitation_channel: null, suppressed_at: null, opted_out_at: null, unreachable_at: null }
  ], [{ worker_id: first, available: true, confirmed_at: "2026-10-14T12:00:00Z", access_expires_at: "2027-01-01T00:00:00Z" }],
  [{ worker_id: first, channel: "whatsapp", revoked_at: null }], [], now);
  assert.equal(report.totals.totalProfiles, 3);
  assert.equal(report.totals.eligibleRecipients, 0, "a shared phone is never a routine recipient");
  assert.equal(report.totals.verifiedOwners, 1);
  assert.equal(report.totals.availableWorkers, 1);
  assert.equal(report.rows.find(row => row.id === first)?.reason, "shared_contact");
  assert.equal(report.rows.find(row => row.id === third)?.reason, "pending_approval");
  assert.equal(report.rows.find(row => row.id === first)?.futureJobNotifications.whatsapp, true);
  assert.doesNotMatch(JSON.stringify(report), /8095550100|whatsapp_number|invitation_evidence/);
  assert.match(ACTIVATION_INVITATION, /\[ENLACE PERSONAL\]/);
});

test("private migration creates a full queue, seven-day SQL guards and atomic owner confirmation", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${owner}');
      create table public.workers(id uuid primary key,owner_user_id uuid references auth.users(id),
        is_verified boolean,available_now boolean,whatsapp_number text);
      insert into public.workers values
        ('${first}','${owner}',true,false,'8095550100'),
        ('${second}',null,true,false,'+18095550100'),
        ('${third}',null,false,false,null);
      grant select,update on public.workers to service_role;`);
    await db.exec(await readFile(new URL("../supabase/migrations/202610081400_worker_availability.sql", import.meta.url), "utf8"));
    await db.exec(`create function public.marketplace_express_targets(uuid,uuid,uuid[]) returns table(worker_id uuid)
        language sql security definer as $$ select null::uuid where now()-interval '30 days'>now() $$;
      create function public.marketplace_express_reserve(uuid,uuid,text,uuid[]) returns uuid
        language sql security definer as $$ select null::uuid where now()-interval '30 days'>now() $$;
      create function public.marketplace_express_chargeable(uuid) returns boolean
        language sql security definer as $$ select now()-interval '30 days'>now() $$;
      create function public.marketplace_express_claim(uuid) returns table(worker_id uuid)
        language sql security definer as $$ select null::uuid where now()-interval '30 days'>now() $$;`);
    const before = (await db.query("select * from public.workers order by id")).rows;
    await db.exec(await readFile(new URL("../supabase/migrations/202610201200_worker_activation_campaign.sql", import.meta.url), "utf8"));
    assert.deepEqual((await db.query("select * from public.workers order by id")).rows, before, "migration does not activate or rewrite workers");
    assert.equal((await db.query("select * from public.worker_activation_queue")).rows.length, 3);
    for (const signature of ["marketplace_express_targets(uuid,uuid,uuid[])","marketplace_express_reserve(uuid,uuid,text,uuid[])",
      "marketplace_express_chargeable(uuid)","marketplace_express_claim(uuid)"]) {
      const result = await db.query<{ source: string }>("select pg_get_functiondef($1::regprocedure) as source", [signature]);
      assert.match(result.rows[0].source, /interval '7 days'/);
      assert.doesNotMatch(result.rows[0].source, /interval '30 days'/);
    }
    for (const role of ["anon","authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from worker_activation_queue"), /permission denied/);
      await assert.rejects(db.query("select * from worker_activation_confirm($1,$2,true)", [owner,first]), /permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.equal((await db.query("select * from worker_activation_confirm($1,$2,true)", [owner,second])).rows.length, 0);
    assert.equal((await db.query("select * from worker_activation_confirm($1,$2,true)", [owner,first])).rows.length, 1);
    assert.equal((await db.query("select * from worker_notification_consent")).rows.length, 0,
      "availability confirmation cannot grant message consent");
    await db.query("select worker_activation_notification_consent($1,$2,'whatsapp',true)", [owner,first]);
    assert.equal((await db.query("select * from worker_notification_consent")).rows.length, 1);
    await db.query("select worker_activation_notification_consent($1,$2,'whatsapp',false)", [owner,first]);
    assert.ok((await db.query<{ revoked_at: Date }>("select revoked_at from worker_notification_consent")).rows[0].revoked_at);
    const token = "a".repeat(64);
    await assert.rejects(db.query("select issue_worker_availability($1,$2)", [second,token]), /worker unavailable/,
      "a legacy bearer link cannot be issued for an unowned profile");
    await db.query("select issue_worker_availability($1,$2)", [first,token]);
    await db.query("update workers set owner_user_id=null where id=$1", [first]);
    assert.equal((await db.query("select * from renew_worker_availability($1,true)", [token])).rows.length, 0,
      "an old private link stops working when ownership is removed");
    await db.query("update workers set owner_user_id=$1 where id=$2", [owner,first]);
    await assert.rejects(db.query("select worker_activation_prepare_batch(array[$1]::uuid[],'whatsapp',100)", [first]), /BATCH_NOT_ELIGIBLE/);
    await db.query("select worker_activation_record_permission($1,'whatsapp','case_12345')", [first]);
    assert.equal((await db.query("select * from worker_activation_permission_events")).rows.length, 1);
    await assert.rejects(db.query("select worker_activation_prepare_batch(array[$1]::uuid[],'whatsapp',100)", [first]), /BATCH_NOT_ELIGIBLE/,
      "shared contacts require review");
    await db.query("update workers set whatsapp_number='8095550199' where id=$1", [second]);
    const batch = await db.query<{ worker_activation_prepare_batch: string }>(
      "select worker_activation_prepare_batch(array[$1]::uuid[],'whatsapp',100)", [first]);
    assert.ok(batch.rows[0].worker_activation_prepare_batch);
    await assert.rejects(db.query("select worker_activation_prepare_batch(array[$1]::uuid[],'whatsapp',100)", [first]), /BATCH_NOT_ELIGIBLE/,
      "the same worker cannot enter another batch");
    assert.equal((await db.query<{ status: string }>("select status from worker_activation_batch_recipients")).rows[0].status, "review");
    await db.query("select worker_activation_self_opt_out($1,$2)", [owner,first]);
    assert.equal((await db.query<{ status: string }>("select status from worker_activation_batch_recipients")).rows[0].status, "opted_out");
    assert.ok((await db.query<{ opted_out_at: Date }>("select opted_out_at from worker_activation_queue where worker_id=$1", [first])).rows[0].opted_out_at);
    await assert.rejects(db.query("select worker_activation_self_opt_out($1,$2)", [owner,second]), /OWNERSHIP_REQUIRED/);
  } finally { await db.close(); }
});
