# ListoRD 2.0

Spanish-first service marketplace for the Dominican Republic:
**NEED → MATCH → CHOOSE → CONTACT**. Details upfront, fast YES/NO decisions,
and direct human contact. Worker discovery and contact are free. Payment never
changes matching or directory order. Express is RD$299 per request, one-time;
there are no new subscription tiers.

Current release decision, evidence and exact blockers:
[2026-10-10 release report](docs/RELEASE_PREPARATION_2026-10-10.md).
The [release contract](LISTORD_2_RELEASE.md) preserves historical checkpoints.

## Local development

Next.js 15, React 19, TypeScript, Supabase Auth/Postgres/Storage and Stripe.
Use Node 24 (the version in `.nvmrc`), then `npm ci` and `npm run dev`.
Copy `.env.example` to an ignored local environment file only when configuring
an authorized environment. No production credentials are required for local tests.
Never place service, Stripe, provider or admin credentials in `NEXT_PUBLIC_*`.

`/solicitar` provides anonymous intake for all 14 existing service categories,
review, real eligible matching and free contextual WhatsApp contact.
`/oportunidades` adds moderated publication, verified-account responses,
withdrawal, owner lifecycle, reusable terms and private response/contact views.
Verification happens when publishing/responding, not while browsing.

All release gates are off by default. Enabling the marketplace requires the
reviewed candidate migrations and hosted safety acceptance. Auth email templates
must send the OTP code; verification of an email does not establish ownership of
an existing worker profile. Worker linking requires independently verified owner
and consent evidence. Sessions live in tab-scoped storage and clear on sign-out.

Express requires a second gate, accepted terms/settlement/provider attestations,
current worker availability and separate outreach consent. Recipients are checked
before payment and dispatch. A Stripe return or WhatsApp inquiry never proves
payment. Signed paid webhooks and audited transfer confirmations share the same
idempotent ledger. An operator starts a bounded batch; uncertain provider sends
are not automatically retried. No-response refunds require actual external
refund evidence before being marked complete.

## Verification

```sh
npm test
npm run lint
npm run build
npm run typecheck
npm run test:e2e:request
npm run security:check
npm audit --omit=dev
npm audit
```

Build and typecheck must run sequentially. Playwright rebuilds with synthetic
public Auth values and blank service/Stripe/provider credentials before its local
server starts. This synthetic build is for local verification only. Run a normal
`npm run build` after browser tests before inspecting a deployment artifact.
Foundation smoke testing
uses a local production server on port 3187; see [the checklist](PRODUCTION_CHECKLIST.md).

The full dependency audit currently retains an upstream braces finding; the
[hash-verified mitigation](docs/BRACES_SECURITY_MITIGATION.md) is checked before
build, test, typecheck and lint. Do not bypass it or describe the raw audit as clean.

## Production safety

Do **not** replay `supabase/schema.sql`, seeds or all historical migrations.
Select candidate migrations only after live catalog reconciliation, backup,
hosted staging acceptance and explicit authorization. Preserve all profiles,
financial records, credentials and existing photo references. Existing edit tokens
are not trusted for ownership; legacy sales remain disabled. Historical payment
entitlements require verified reconciliation, never phone-only recovery.

No local test authorizes production SQL, worker activation, messages, live charges,
push or deployment. Database authentication and hosting access are external
acceptance blockers; they do not prevent repository development.

New photos retain the established decode/orient/bound/WebP pipeline and direct
source delivery with `images.unoptimized: true`. No bulk photo migration is needed.
See [photo infrastructure](docs/PHOTO_PIPELINE.md),
[privacy/activation runbook](docs/WORKER_PRIVACY_ACTIVATION.md), and
[production acceptance checklist](PRODUCTION_CHECKLIST.md).
