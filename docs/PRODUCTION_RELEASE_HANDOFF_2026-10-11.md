# ListoRD 2.0 production handoff — 2026-10-11 EDT

**Current state:** the narrowly scoped security hotfix is live on the existing
Vercel `listord` project, and the reviewed additive 2.0 schema is in production.
The full 2.0 application and feature gates have not been released.

**Revenue activation audit, 2026-10-11:** the existing RD$3,000 DOP one-time
employer deposit pays for an operator-led search and connection effort, not
Express or a digital premium entitlement. Its checkout and admin payment ledger
are separate from the employer request list: no payment-to-request link, worker
availability proof, operator assignment, response window or remedy is verified.
The public copy promises available workers, while the hosted sample match had
zero fresh matches and no current availability pool has been verified. Do not
charge for this offer until the owner
approves an honest, deliverable service scope and an operator can carry it out.
The local payment repair now uses a separate default-off
`EMPLOYER_DEPOSIT_ENABLED` gate, refuses checkout URLs without a saved payment
row, uses a configured HTTPS return origin, retries signed paid webhooks without
a confirmed row update, and processes delayed-payment success. It is committed
locally but **not deployed**. The Netlify candidate and every paid gate remain
off; no Stripe Checkout or live payment was attempted in this audit.

**Latest hosted acceptance, 2026-10-11:** Netlify draft deploy
`6acc1429e7e62296355409a0` is serving
`https://release-candidate--listord-2.netlify.app` after the current Netlify
environment was applied. Production and deploy-preview both contain the
Supabase public and service-role keys, Stripe secret and webhook secret, and
all three admin login names. The five sensitive keys are marked secret and
available to builds and functions; no value was displayed. All release,
legacy payment/edit and Express outreach gates remain false. Hosted checks:
378 approved worker links, filtered browsing, 200 on the worker registration
form, 200 on a valid match request with zero fresh matches, 200 on a selected
worker's contextual click-to-WhatsApp URL without sending a message, no private
field names in worker listing/profile HTML, invalid admin login rejected,
protected admin route redirected, invalid Stripe signature rejected with 400,
and all checkout routes rejected with 503. A real registration insert, successful
admin login, Stripe test Checkout, signed provider webhook and entitlement grant
remain unverified; no payment, worker row or message was created by acceptance.
The Netlify CLI confirms the stored Stripe key name and secret metadata but
masks its value, so key mode cannot be independently confirmed from that
inventory. Marketplace employer publication and its verified-email sign-in
remain behind `MARKETPLACE_ENABLED=false`; no test employer account was created.
The checkout gates are deliberate: no consented, deliverable Express targets or
approved outreach fulfillment exists. The local Node 24 suite passed 74/74,
including signed webhook/order-binding fixtures; lint, typecheck and the
rebuilt-bundle security scan passed. These fixtures do not establish a hosted
payment or entitlement.
After the browser suite passed 54/54, the inactive RD$3,000 legacy deposit
link was removed from the header and its direct page was gated. The refreshed
candidate shows no deposit Pay button or price; the checkout API still returns
503. Netlify returned a not-found page body with HTTP 200 for the direct page,
so do not count that response as a proper HTTP 404. This does not affect the
payment gate. Lint, typecheck and the Netlify build passed after the change.

**Owner's revised launch scope:** the four Meta WhatsApp Business API variables
`WHATSAPP_GRAPH_VERSION`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_EXPRESS_TEMPLATE`, and `WHATSAPP_ACCESS_TOKEN` are **not current launch
requirements**. Free click-to-WhatsApp contact works without them. Automated
Express outreach and paid Express activation stay disabled until the owner
approves and verifies an operational fulfillment method, terms, worker consent,
and DOP settlement. Do not open another checkout route as a substitute for
Express: legacy subscriptions need absent Price IDs and historical premium
access is support-only; the RD$3,000 employer deposit promises an operator-led
search, not the 2.0 Express entitlement. No live charge was enabled.

**Netlify migration update, 2026-10-11:** the full 2.0 tree is deployed as a
draft on the existing Netlify Free team at
`https://release-candidate--listord-2.netlify.app` (site
`fb77aa65-3fd4-4d82-b40b-380e768b2fab`, deploy
`6acbe48ba8d2f592a6849150`). The `listord-2.netlify.app` production URL
has not been promoted. Netlify's automatic OpenNext adapter built the Next.js
15 server handler and middleware edge function using `netlify.toml` and the
existing Node 24 `.nvmrc`. Public Supabase URL/key and Netlify origin are set;
marketplace, Express, availability renewal, legacy edit/checkout and Express
outreach gates are explicitly false. No server-only Supabase key, Stripe key,
admin credential or Meta sender credential was copied from Vercel: its stored
production secrets are non-readable. The candidate renders 378 approved worker
profiles and filtered search. Registration and contact need the missing
Supabase service-role key before live acceptance. Invalid contact returned 400;
marketplace and Express returned 503; an invalid-signature webhook returned 500 because
Stripe configuration is absent, so no entitlement was activated. The Node 24
suite passed 74/74 and the rebuilt-bundle security scan passed after this
deploy. The live database currently has **384** workers: one additional,
unapproved, unowned row was created at 2026-10-11 15:23:49 UTC, before this
Netlify deployment; this release made no worker writes. The existing 383 rows
remain and 378 approved profiles are visible. Vercel and DNS are unchanged.

**Netlify release path:** verify the existing Stripe key is test mode and the
Netlify test webhook destination/signing secret match; allow the Netlify origin
in Supabase Auth redirects. Obtain an authorized real worker and employer test
account for hosted registration, ownership and consent checks. Keep paid gates
closed until the owner approves a deliverable paid offer and its fulfillment.
Do not infer consent from a shared phone or enable live Stripe charges from a
test result.
The Netlify CLI is authenticated. Rebuild the candidate after credentials are
configured, then publish the tested tree only after hosted acceptance:

```sh
cd ~/listord
export PATH=/home/darnellfischer1/.npm/_npx/538786c08bcb9442/node_modules/node/bin:$PATH
NCLI=/home/darnellfischer1/.npm/_npx/da5c1b6ea715e8b4/node_modules/netlify-cli/bin/run.js
node "$NCLI" deploy --site fb77aa65-3fd4-4d82-b40b-380e768b2fab --alias release-candidate --context production --json
node "$NCLI" deploy --prod --site fb77aa65-3fd4-4d82-b40b-380e768b2fab --context production --json
```

After the owner approves DNS cutover, add `listordapp.com` to the Netlify site,
set the production origin/public URL to `https://listordapp.com`, rebuild and
test Netlify's production URL, then change the external DNS records. Current
records are apex A `76.76.21.21` and `www` CNAME `cname.vercel-dns.com`, with
Namecheap name servers. Netlify's current external-DNS guidance uses apex
ALIAS/ANAME to `apex-loadbalancer.netlify.com` where supported (otherwise A
`75.2.60.5`) and `www` CNAME `listord-2.netlify.app`. Check HTTPS, both hosts,
webhook and Auth redirects after propagation. For rollback, restore those two
record values to Vercel, leave its security hotfix deployed, and keep paid gates
off; the additive Supabase schema stays in place. No DNS change or live payment
was made in this update.

**Prompt 3 update, later on 2026-10-11:** shared-phone compatibility and the
commercial code path are prepared locally. The service-only
`marketplace_contact_context` migration is applied as ledger version
`20261011144931`. Payment gates remain off; no live payment was attempted.

**Prompt 4 update:** production Vercel now has
`APP_ORIGIN=https://listordapp.com` and explicit `false` values for
`MARKETPLACE_ENABLED`, `EXPRESS_ENABLED`, `WORKER_AVAILABILITY_RENEWAL_ENABLED`,
`LEGACY_WORKER_EDIT_ENABLED`, `LEGACY_CHECKOUT_ENABLED`, and
`EXPRESS_OUTREACH_ACCEPTED`. The variable-name inventory confirms each entry.
No deployment followed these changes; the existing hotfix still serves its
original configuration snapshot. Existing Stripe and Supabase secrets were
neither displayed nor changed. Admin and Meta sender/template variables remain
absent. Masked credentials do not establish Stripe key mode, webhook destination,
or DOP settlement; no hosted Stripe or Meta transaction is claimed.

The [ownership and consent runbook](WORKER_OWNERSHIP_CONSENT_RUNBOOK_2026-10-11.md)
requires independent per-profile evidence, a confirmed Auth account, a private
case reference, and separate worker actions for availability and outreach
consent. The 2.0 API now refuses availability links for unowned profiles;
confirmed matching and contact also exclude them. Historical directory copy
no longer claims current availability or identity verification. Express purchase
controls remain hidden while its gate is off. No production worker row or
consent was changed. The [Express terms draft](EXPRESS_TERMS_FOR_OWNER_APPROVAL_2026-10-11.md)
is prepared for owner approval and remains unaccepted.
Final Node 24 regression rerun passed: 74/74 unit/integration tests, 54/54
desktop/mobile browser cases, lint, typecheck, 167-page production build, and
the rebuilt-bundle security scan. The braces test's sandbox failure was caused
by blocked subprocess creation; all six focused cases and the full suite passed
with the permitted subprocess. No guard was weakened.

## Live security hotfix

Vercel deployment `dpl_4iVv4nQ5yxVBeg4Nk5sbzNkKb7S6` is READY and promoted.
`listordapp.com` and `www.listordapp.com` point to its deployment URL
`listord-qxr8v2l0y-darnellfischer1-3955s-projects.vercel.app`.
It was built from deployed legacy commit `975196bb` with only three security
source changes: `app/resultados/actions.ts` redirects to a pending outcome
without an unchecked write; `lib/employer-sessions.ts` reports upsert failure;
and `app/api/workers/contact/route.ts` returns 500 if that write fails or
throws, before any contact success. The existing `contact_attempts` write
already checked its error. This is still the legacy Next.js 14 app.

An isolated API transport fixture confirmed a failed employer-session upsert
returns 500 and does not perform a worker lookup or return a contact URL. The
staged deployment served the homepage and pending page with 200, and rejected
an invalid contact POST with 400. After promotion the live homepage returned
200 and the invalid contact POST returned 400. No synthetic valid contact or
registration write was sent to production.

## Production schema and data

Supabase project `rkgtykbekaeruyhdmvbo` records, in order:

| Version | Migration | State |
| --- | --- | --- |
| `20261011013432` | `restrict_legacy_rpc_execution` | Applied security repair |
| `20261011134526` | `worker_public_privacy` | Applied security repair |
| `20261011141221` | `marketplace_foundation` | Applied additive schema |
| `20261011141457` | `worker_availability` | Applied additive schema |
| `20261011141542` | `worker_owner_identity` | Applied nullable owner column |
| `20261011141607` | `marketplace_lifecycle` | Applied additive schema |
| `20261011141654` | `express_fulfillment` | Applied separate ledgers |
| `20261011142135` | `ingestion_budget` | Applied private budget only |
| `20261011144931` | `marketplace_contact_context` | Applied service-only contact RPC; no row changes |

Each 2.0 migration was dependency-reviewed and tested on isolated PostgreSQL,
then applied separately. Read-only production checks after each migration and
after the hotfix showed **383 workers** and the same legacy-field digest
`1cdccc9d19877bb0e8f497dc2c4777a3`. The original full-row digest before
the nullable owner column was `5ee2ec609330ba98539fbbef7fa92e8f`.
`contact_requests`, owner assignments, opportunities and Express orders are
all zero. Public REST checks retained approved-worker browsing and rejected
private columns/tables. No existing worker or payment row was rewritten,
merged, deleted or activated.

The Supabase migration ledger versions above differ from the date prefixes of
the reviewed local SQL files because the migrations were applied individually
through the hosted API. Reconcile that mapping before using a bulk migration
command; never replay the local historical files or `supabase/schema.sql`.

The 19 normalized-phone groups covering 40 existing rows are preserved.
The unapplied unique-index candidate was retired because a shared phone can
belong to distinct legitimate workers. Current registration and the disabled
legacy editor no longer reject another profile solely because its WhatsApp
number is shared. The fresh-install schema now uses a non-unique phone lookup
index. A local database test inserts a distinct third profile with a shared
number. Worker ID and verified account ownership remain the identity boundary;
no owner was inferred from a phone. Production has no WhatsApp uniqueness
index, so no corrective data migration or row rewrite was needed.

The 2.0 free directory and request contacts now include the selected worker
profile in WhatsApp text. Authorized marketplace contacts use the new RPC to
return the specific worker ID and name with the opportunity context. Express
invitations carry both the opportunity ID and intended worker ID in their
public URL; the browser selects that profile only if the signed-in account
owns it. The URL itself does not confer ownership.

Express Checkout remains a one-time RD$299 DOP payment. The server checks
eligible, consented targets before creating Checkout and persists the exact
Stripe Session ID before returning its URL. A retrieved Checkout Session is
rechecked against the order, amount and currency before any retry shows its
URL. A signed paid webhook must match
that stored session, amount, currency, order and payment intent before it can
mark the separate Express ledger paid. Early webhook delivery returns a retryable
error until the session binding is present. Return URLs never activate payment
or entitlements. Idempotency, dispatch claim and remedy paths passed local
fixtures; no live Stripe or WhatsApp transaction is claimed.

## Local verification and next release step

On Node 24, `npm test` passed 74/74, `npm run lint`, `npm run typecheck` and
`npm run security:check` passed. The browser fixture suite passed 54/54 desktop
and mobile cases, including selected-worker invitation links. The final 2.0
production build passed (167 generated pages). The earlier legacy
hotfix build passed on Vercel (169 pages).

**Historical Prompt 4 Vercel plan, superseded by the Netlify update above:** on the existing project,
set and verify the missing admin, Auth/origin, Meta WhatsApp sender/template and
Express release variables without printing secrets; confirm the Stripe webhook
destination/signature and DOP settlement with a real test-mode payment and
replay. Complete verified worker-owner recovery, outreach consent and availability
for real profiles; production currently has zero linked owners, zero opportunities
and zero Express orders, so live fulfillment cannot yet be accepted. Approve the
draft Express terms/remedy and establish payment-capable hosting within the
owner's cost rule. Then stage the full Next.js 15 build on the existing Vercel
project, run read-only smoke plus authorized provider acceptance, and promote
that exact deployment. The current team is Hobby; Vercel's published fair-use
rules classify requesting or processing payment as commercial use, so Express
cannot be turned on there without resolving that hosting constraint.

The earlier Vercel variable-name inventory included legacy Supabase and
Stripe keys, but lacks `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
`ADMIN_SESSION_SECRET`, `WHATSAPP_GRAPH_VERSION`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_EXPRESS_TEMPLATE`,
`WHATSAPP_ACCESS_TOKEN`, `EXPRESS_ACCEPTED_TERMS`, and
`EXPRESS_SETTLEMENT_VERIFIED`. A transfer path additionally needs a verified
`EXPRESS_TRANSFER_CONTACT`. Existing Stripe secret values were not inspected.
Keep all release and legacy sales/edit gates false until the corresponding
external checks pass. The [Vercel fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines)
are the source for the Hobby commercial-use restriction.
The marketplace, Express, availability renewal, legacy edit and legacy
checkout gates remain off. Do not treat the applied schema or hotfix as 2.0
product acceptance.

The owner waived a newly verified backup and authorized this security hotfix
and the non-destructive schema migrations. No database credential reset, new
infrastructure, paid upgrade or checkpoint commit was made. The working tree
contains the local 2.0 implementation and this handoff; the hotfix was deployed
from an isolated snapshot and was not a full-main deployment.

## Production deployment and rollback procedure

Historical Vercel procedure, superseded by the Netlify release path above.
Retained only to identify the known Vercel rollback target.

Do not stage or promote the commercial build while the existing Vercel team is
Hobby: [Vercel's fair-use rule](https://vercel.com/docs/limits/fair-use-guidelines)
requires a commercial plan for a site that requests or processes payments.
The owner must select compliant hosting; no paid upgrade is authorized by this
handoff. If the owner authorizes the existing Vercel project on a compliant
plan, provision the existing admin credentials and verified Meta sender/template
through the dashboard, confirm the Auth redirect allowlist and origin, approve
the final Express terms/refund operator, and run a controlled Stripe **test-mode**
Checkout plus signed webhook and Meta acceptance. Keep live charges and all
commercial flags disabled pending separate authorization. No database migration
command is needed; the reviewed additive schema is already applied. Never run
`supabase db push` against the unreconciled local migration history.

From the reviewed source tree, run:

```sh
cd ~/listord
export PATH=/home/darnellfischer1/.npm/_npx/538786c08bcb9442/node_modules/node/bin:$PATH
VCLI=/home/darnellfischer1/.npm/_npx/69f9afb961c37556/node_modules/vercel/dist/index.js
npm test
npm run lint
npm run build
npm run typecheck
npm run test:e2e:request
npm run security:check
node "$VCLI" deploy --prod --skip-domain --scope darnellfischer1-3955s-projects --project listord
```

Record the staged production URL. Check homepage, registration, directory,
matching, contact, admin login, marketplace/Express closed gates, and invalid
Stripe signature rejection on that URL. Confirm the worker count is still 383
and the legacy-field digest remains `1cdccc9d19877bb0e8f497dc2c4777a3`.
Promote only the tested URL:

```sh
node "$VCLI" promote <staged-production-url> --scope darnellfischer1-3955s-projects
```

If the release regresses, keep the paid gates false and restore the known
security hotfix. The additive schema remains; do not reverse it:

```sh
node "$VCLI" rollback dpl_4iVv4nQ5yxVBeg4Nk5sbzNkKb7S6 --scope darnellfischer1-3955s-projects
```

The current local CLI is Vercel 62.2.0 on Node 24; this checkout is not linked,
so `--project listord` is required for deployment. Vercel documents
[staging and promotion](https://vercel.com/docs/cli/deploying-from-cli) and
[rollback](https://vercel.com/docs/cli/rollback). Hobby rollback is limited to
the previous production deployment; verify the target before promotion.
