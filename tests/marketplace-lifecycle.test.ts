import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { publication } from "../lib/marketplace";
import { emptyRequest } from "../lib/request-specification";

const owner = "11111111-1111-4111-8111-111111111111";
const workerOwner = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
const worker = "44444444-4444-4444-8444-444444444444";
export const fixtureDraft = { ...emptyRequest(), category: "limpieza", city: "Puerto Plata", answers: { property: "Casa", tasks: "Limpiar pisos y baños", supplies: "Los pongo yo" }, timing: "Mañana a las nueve", duration: "4 horas", amount: "1500" };

test("publication validates the existing category schema and separates private contact from public terms", () => {
  const p = publication({ draft: fixtureDraft, key: owner, name: "Ana", phone: "+18090000999", consent: true });
  assert.ok(p); assert.equal(p.phone, "18090000999"); assert.equal(p.draft.amount, 1500);
  assert.ok(!JSON.stringify(p.draft).includes("18090000999"));
  for (const invalid of [{ consent: false }, { phone: 123 }, { key: "bad" }, { draft: { ...fixtureDraft, amount: "NaN" } }, { draft: { ...fixtureDraft, answers: { tasks: "test" } } }]) {
    assert.equal(publication({ draft: fixtureDraft, key: owner, name: "Ana", phone: "+18090000999", consent: true, ...invalid }), null);
  }
});

test("transactional opportunity and Express lifecycle: ownership, moderation, YES/NO, privacy, consent, payment replay and remedy", async () => {
  const db = new PGlite();
  const rpc = async (name: string, args: unknown[]) => {
    const result = await db.query<Record<string, unknown>>(`select * from ${name}(${args.map((_, i) => `$${i + 1}`).join(",")})`, args);
    return result.rows;
  };
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      insert into auth.users values('${owner}'),('${workerOwner}'),('${stranger}');
      create table workers(id uuid primary key,owner_user_id uuid references auth.users(id),is_verified boolean,available_now boolean,full_name text,whatsapp_number text);
      insert into workers values('${worker}','${workerOwner}',true,true,'Worker fixture','18090000111');
      create table worker_availability(worker_id uuid primary key references workers(id),available boolean,confirmed_at timestamptz,access_expires_at timestamptz);
      insert into worker_availability values('${worker}',true,now(),now()+interval '30 days');
      create table legacy_entitlements(id integer primary key,amount integer); insert into legacy_entitlements values(1,10000);`);
    for (const filename of ["202610071200_marketplace_foundation.sql", "202610091200_marketplace_lifecycle.sql", "202610091300_express_fulfillment.sql", "202610101200_ingestion_budget.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8"));
    }
    await assert.rejects(db.query("insert into workers(id,owner_user_id,is_verified,available_now,full_name,whatsapp_number) values($1,$2,false,false,'Duplicate fixture','8090000111')", ["66666666-6666-4666-8666-666666666666", workerOwner]), /unique constraint/);
    const p = publication({ draft: fixtureDraft, key: owner, name: "Private employer", phone: "+18090000999", consent: true })!;
    const create = async (key: string) => (await rpc("marketplace_create", [owner, key, p.draft, p.name, p.phone, true]))[0].marketplace_create as string;
    const id = await create(owner);
    assert.equal(await create(owner), id, "idempotent publication retries");
    await db.exec("set role anon");
    assert.equal((await db.query("select * from marketplace_opportunities")).rows.length, 0);
    for (const table of ["marketplace_events", "marketplace_express_orders", "marketplace_express_invitations", "marketplace_outreach_consent", "marketplace_payment_events"]) await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
    await assert.rejects(rpc("marketplace_moderate", [id, true]), /permission denied/);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(rpc("marketplace_decide", [workerOwner, id, worker, "interested"]), /permission denied/);
    await db.exec("reset role");
    await assert.rejects(rpc("marketplace_decide", [workerOwner, id, worker, "interested"]), /NOT_OPEN/);
    await rpc("marketplace_moderate", [id, true]);
    await assert.rejects(rpc("marketplace_decide", [stranger, id, worker, "interested"]), /OWNERSHIP/);
    await assert.rejects(rpc("marketplace_transition", [stranger, id, "closed"]), /NOT_FOUND/);
    await assert.rejects(rpc("marketplace_contacts", [stranger, id]), /OWNERSHIP/);
    await rpc("marketplace_decide", [workerOwner, id, worker, "declined"]);
    assert.equal((await rpc("marketplace_contacts", [owner, id])).length, 0);
    await rpc("marketplace_decide", [workerOwner, id, worker, "interested"]);
    assert.deepEqual(await rpc("marketplace_contacts", [owner, id]), [{ name: "Worker fixture", phone: "18090000111" }]);
    assert.deepEqual(await rpc("marketplace_contacts", [workerOwner, id]), [{ name: "Private employer", phone: "18090000999" }]);
    await db.query("update workers set owner_user_id=$1 where id=$2", [stranger, worker]);
    assert.equal((await rpc("marketplace_contacts", [owner, id])).length, 0, "ownership transfer invalidates old response authority");
    await assert.rejects(rpc("marketplace_contacts", [stranger, id]), /OWNERSHIP/);
    await db.query("update workers set owner_user_id=$1 where id=$2", [workerOwner, worker]);
    await rpc("marketplace_decide", [workerOwner, id, worker, "withdrawn"]);
    await assert.rejects(rpc("marketplace_express_reserve", [owner, id, "stripe", [worker]]), /NO_DELIVERABLE/);
    await rpc("marketplace_consent", [workerOwner, worker, true]);
    assert.deepEqual(await rpc("marketplace_express_targets", [owner, id, [worker]]), [{ worker_id: worker }]);
    await rpc("marketplace_decide", [workerOwner, id, worker, "declined"]);
    assert.equal((await rpc("marketplace_express_targets", [owner, id, [worker]])).length, 0, "NO prevents paid outreach");
    await assert.rejects(rpc("marketplace_express_reserve", [owner, id, "stripe", [worker]]), /NO_DELIVERABLE/);
    await rpc("marketplace_decide", [workerOwner, id, worker, "withdrawn"]);
    await db.query("update workers set whatsapp_number=null where id=$1", [worker]);
    assert.equal((await rpc("marketplace_express_targets", [owner, id, [worker]])).length, 0, "unreachable workers cannot be charged for");
    await db.query("update workers set whatsapp_number='18090000111' where id=$1", [worker]);
    const order = (await rpc("marketplace_express_reserve", [owner, id, "stripe", [worker]]))[0].marketplace_express_reserve;
    assert.equal((await rpc("marketplace_express_reserve", [owner, id, "stripe", [worker]]))[0].marketplace_express_reserve, order);
    await assert.rejects(rpc("marketplace_express_reserve", [owner, id, "transfer", [worker]]), /CHANNEL_SWITCH/);
    assert.equal((await rpc("marketplace_express_claim", [order])).length, 0, "unpaid order never sends");
    await assert.rejects(rpc("marketplace_express_sent", [order, worker, "receipt_1"]), /INVALID_DELIVERY/);
    const pay = [order, "stripe", "pi_fixture", "evt_fixture", 29900, "dop", "stripe_signed_webhook"];
    await assert.rejects(rpc("marketplace_express_paid", [...pay.slice(0, 4), 1, "dop", "stripe"]), /INVALID_PAYMENT/);
    await rpc("marketplace_express_paid", pay); await rpc("marketplace_express_paid", pay);
    await rpc("marketplace_express_paid", [order, "stripe", "pi_fixture", "evt_second", 29900, "dop", "stripe"]);
    await assert.rejects(rpc("marketplace_express_paid", [order, "stripe", "pi_other", "evt_third", 29900, "dop", "stripe"]), /DUPLICATE_PAYMENT/);
    assert.equal((await rpc("marketplace_express_claim", [order])).length, 1);
    assert.equal((await rpc("marketplace_express_claim", [order])).length, 0, "ambiguous send cannot be retried");
    await rpc("marketplace_express_sent", [order, worker, "receipt_1"]);
    await rpc("marketplace_express_sent", [order, worker, "receipt_1"]);
    assert.equal((await rpc("marketplace_express_reconcile", [order]))[0].marketplace_express_reconcile, "paid", "sending is not interest");
    await rpc("marketplace_decide", [workerOwner, id, worker, "interested"]);
    assert.equal((await rpc("marketplace_express_reconcile", [order]))[0].marketplace_express_reconcile, "fulfilled");
    await rpc("marketplace_transition", [owner, id, "filled"]);
    await assert.rejects(rpc("marketplace_decide", [workerOwner, id, worker, "declined"]), /NOT_OPEN/);
    await rpc("marketplace_decide", [workerOwner, id, worker, "withdrawn"]);
    await assert.rejects(rpc("marketplace_contacts", [owner, id]), /NOT_OPEN/);
    await assert.rejects(rpc("marketplace_moderate", [id, true]), /INVALID_TRANSITION/);

    const second = await create(workerOwner); await rpc("marketplace_moderate", [second, true]);
    const transfer = (await rpc("marketplace_express_reserve", [owner, second, "transfer", [worker]]))[0].marketplace_express_reserve;
    await rpc("marketplace_express_paid", [transfer, "transfer", "bank_fixture", "transfer_fixture", 29900, "dop", "admin:test"]);
    await rpc("marketplace_consent", [workerOwner, worker, false]);
    assert.equal((await rpc("marketplace_express_claim", [transfer])).length, 0);
    assert.equal((await rpc("marketplace_express_reconcile", [transfer]))[0].marketplace_express_reconcile, "remedy_due");
    await rpc("marketplace_express_refund", [transfer, "refund_fixture", "refund_event", "admin:test"]);
    await rpc("marketplace_express_refund", [transfer, "refund_fixture", "refund_event", "admin:test"]);
    await rpc("marketplace_express_paid", [transfer, "transfer", "bank_fixture", "transfer_fixture", 29900, "dop", "admin:test"]);
    assert.equal((await rpc("marketplace_express_reconcile", [transfer]))[0].marketplace_express_reconcile, "refunded", "late webhook cannot reactivate entitlement");
    assert.deepEqual((await db.query("select * from legacy_entitlements")).rows, [{ id: 1, amount: 10000 }]);
    // Moderation reports have an executable resolution path and remove public access.
    await rpc("marketplace_report", [workerOwner, second, "privacy"]);
    const report = (await db.query<{ id: string }>("select id from marketplace_reports limit 1")).rows[0].id;
    await rpc("marketplace_resolve_report", [report, true]);
    assert.equal((await db.query<{ status: string }>("select status from marketplace_reports where id=$1", [report])).rows[0].status, "resolved");
    await assert.rejects(rpc("marketplace_contacts", [owner, second]), /NOT_OPEN/);
    // Recovery cannot replace an existing owner, approve or activate a profile.
    await assert.rejects(rpc("marketplace_link_owner", [worker, stranger, "case_fixture", "operator_fixture"]), /OWNERSHIP/);
    await db.query("update workers set owner_user_id=null,is_verified=false,available_now=false where id=$1", [worker]);
    await rpc("marketplace_link_owner", [worker, workerOwner, "case_fixture", "operator_fixture"]);
    assert.deepEqual((await db.query("select is_verified,available_now from workers where id=$1", [worker])).rows, [{ is_verified: false, available_now: false }]);
    assert.equal((await db.query("select * from marketplace_ownership_audit")).rows.length, 1);
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from marketplace_ownership_audit"), /permission denied/);
    const publicRows = await db.query("select * from marketplace_opportunities");
    assert.doesNotMatch(JSON.stringify(publicRows.rows), /18090000999|Private employer/);
    await db.exec("reset role");
    for (let i = 0; i < 5; i++) assert.equal((await rpc("marketplace_ingestion_budget", ["registration", "a".repeat(64)]))[0].marketplace_ingestion_budget, true);
    assert.equal((await rpc("marketplace_ingestion_budget", ["registration", "a".repeat(64)]))[0].marketplace_ingestion_budget, false);
    await assert.rejects(rpc("marketplace_ingestion_budget", ["other", "a".repeat(64)]), /INVALID_BUDGET/);
    await db.exec("set role anon");
    await assert.rejects(rpc("marketplace_ingestion_budget", ["analytics", "a".repeat(64)]), /permission denied/);
    await db.exec("reset role");
    for (let i = 0; i < 3; i++) await create(`55555555-5555-4555-8555-${String(i).padStart(12, "0")}`);
    await assert.rejects(create("55555555-5555-4555-8555-999999999999"), /RATE_LIMIT/);
  } finally { await db.close(); }
});
