# Contact credits: interrupted launch gate — 2026-10-20

**Decision: BLOCKED.** The authorized launch stopped before any production mutation. The release candidate remains `01d6410` on `worker-activation-prep`; the prior protected Netlify deploy was `6ad679e83291e75b856113ca`. The live deploy was not rechecked in this session. No live Stripe price, webhook, Netlify setting, production migration, production record, or worker message was changed.

## Fresh backup and isolated restore

- A read-only, serializable `pg_dump` of production was created at 2026-10-20 05:05 UTC. It is a PostgreSQL custom-format dump at `/tmp/listord-release/production-backup-launch-20261020T0505Z.dump`, 2,311,344 bytes, file mode `0600`, SHA-256 `54828b00f7f2b5784018a37a7e11daca06f8af55e582937ec193bef8860192d3`.
- `pg_restore -l` read all 1,021 TOC entries. A single-transaction, fail-on-error restore into the isolated Unix-socket-only PostgreSQL database `listord_credit_launch_current` succeeded. The test restore omitted 10 Supabase-managed Vault entries and restored without source owners/ACLs; it includes application, auth, worker, and historical purchase data. The backup itself retains those entries.
- The earlier 412-worker dump was superseded: two workers and their activation rows were created in production after it. The fresh restore and the current read-only production snapshot each have **414 workers, 414 activation rows, and 7 auth users**. Worker and activation ID-set hashes match. Full-row hashes match when both sessions use UTC, confirming the migrations left these restored rows intact. No worker contact values were printed or copied into this report.
- The dump is presently a local plaintext file under a mode-`0700` directory, not a durable, encrypted, operator-controlled recovery copy. A durable encrypted backup and its restoration procedure remain unverified. The isolated restore also lacks Supabase-managed Vault objects and source grants, so it does not prove a full managed-service restore.

## Credit migration rehearsal

- Applied only `20261019202538_contact_credit_ledger.sql`, then `20261019202539_contact_credit_funnel.sql`, to `listord_credit_launch_current`. Both committed without errors. No migration was applied to production.
- `tests/contact-credit-ledger.sql` passed within its rollback transaction: paid pack, duplicate fulfillment, test/live separation, one-credit spending, repeat unlock, refund revocation, replay denial, and repurchase behavior.
- A separate synthetic 1-credit order was settled in the isolated database. Two concurrent **independent PostgreSQL connections** attempted distinct worker unlocks. Exactly one was allowed; the other was denied; the order ended with zero credits and exactly one spend row. The synthetic order and spend remain only in the isolated test database.
- All four new credit tables have RLS enabled and deny `SELECT` to `anon` and `authenticated`. Both `authorize_worker_contact` and `settle_contact_credit_order` deny execution to those roles and allow `service_role`. The test restore used `--no-acl`, so these checks verify the new migration grants rather than every production grant.
- The restored historical rows remain: two paid direct-contact orders, two paid workspace orders (including one test-mode order), two failed workspace orders, and one legacy access row. The legacy row's stored access end had already passed in the previous audit. No legacy owner link was manufactured.
- Focused `node --import tsx --test tests/contact-credits.test.ts` passed 4/4, covering the local signed-webhook fixture, exact packs, old access, reversals, and live gate requirements. These fixture tests do not constitute a provider-hosted Checkout transaction.

## Release blockers and next gate

1. Store a fresh production dump in durable encrypted operator-controlled storage, then verify the retained copy can restore. Resolve whether the managed Vault exclusions are acceptable for recovery, and verify the production grant/role path separately.
2. Obtain a Stripe **test-mode** context and exact active test prices. Complete real test-mode Checkout through a signed webhook, credit allocation, unlock, and WhatsApp handoff without sending a message or making a live charge. This session's connected Stripe account exposes only `livemode=true`; no test API credential or Stripe CLI was available. Local signed-webhook fixtures are insufficient for this gate.
3. Recheck the current protected Netlify deploy, effective environment, production worker/entitlement aggregates, and outstanding Supabase security-advisor finding before any live change. Then verify and activate the existing exact live DOP prices, add missing dispute webhook events, configure Netlify gates, apply only the two credit migrations, and deploy the tested commit in the order specified by [the release runbook](CONTACT_CREDITS_RELEASE_2026-10-19.md). Stop if any financial, data, or security gate fails.

The previous readiness assessment remains a historical record of its 2026-10-19 audit. This document records subsequent evidence and supersedes its statements that no fresh dump or production-data migration rehearsal existed. It does **not** authorize deployment by itself.

## Stripe test connection follow-up — 2026-10-20

The Blackthorne Industries Stripe account is now connected in **both** live and test contexts. The test context is accessible for authenticated API reads, but the provider-hosted credit Checkout gate is still **not complete**:

- The only active DOP test price returned by Stripe was a **recurring RD$199 historical workspace price** (`price_1TQdfgDcsfbyUKoSPPMCLfpE`). There were no active or inactive DOP test prices for the new 1/5/10 contact-credit packs. That workspace price was not used as a credit price.
- The sole test-mode webhook endpoint points to `https://release-candidate--listord-2.netlify.app/api/stripe/webhook` and subscribes to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Its public homepage still shows earlier ListoRD positioning, so it is not evidence of an isolated current credit release candidate.
- This workspace has no local test Stripe secret key, test webhook signing secret, Stripe CLI, or isolated current Supabase app/API environment configured. The connected Stripe API context permits account operations but does not supply credentials to run this repository's Checkout and webhook routes locally. No test Checkout session was created, no test payment was made, and no Stripe product, price, or webhook endpoint was changed.

To resume, provision an isolated current app/database and supply its test key and webhook signing secret through an ignored, access-restricted secret configuration (never in chat or Git). Then create/verify exact active one-time DOP test prices, configure the isolated checkout and signed-event delivery, and run the real hosted Checkout through credit allocation, unlock, and WhatsApp URL handoff. The backup gate and all live changes remain closed.
