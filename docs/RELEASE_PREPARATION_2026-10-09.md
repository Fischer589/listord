# Release preparation checkpoint — 2026-10-09

Decision: **NOT RELEASE READY**. Local preparation is verified; production acceptance
and the full 2.0 contract are not complete. This document supersedes older verification
counts and dependency findings, without erasing their historical evidence.

## External database authentication blocker

The existing `listord_audit` service uses the project-qualified
`listord_auditor.<project-ref>` username on the configured Session Pooler host,
port 5432, database `postgres`, `sslmode=verify-full`, the existing CA certificate,
and `default_transaction_read_only=on`. The earlier connection reached password
authentication and returned `fe_sendauth: no password supplied`.

The owner separately confirmed SQL Editor identity `postgres` and membership of
`listord_auditor`. This does not authenticate the local auditor connection or provide
a hidden password input channel. No new authentication attempt was made in this
checkpoint. Configuration, certificates, roles, grants, passwords and production
records remain untouched. No credential request, password-setting helper, reset,
SQL Editor secret query, migration, worker activation, push or deployment was run.

## Changes prepared locally

- Next 14.2.3 → **15.5.27**, React/React DOM **19.2.8**, Supabase JS **2.117.3**;
  Node **24.21.0** used for verification and `24.x` required by package engines.
  Async cookies/route props and React action hooks migrated, every server admin
  guard awaited, lint moved to ESLint CLI. Production build succeeds.
- PostCSS **8.5.29** pinned/overridden throughout the dependency tree, including
  Next's previously nested vulnerable copy; selector parser **7.1.6** overridden.
  Compatible transitive patches installed. No forced audit fix or advisory suppression.
  The remaining braces recursion issue now has a reproducible, hash-verified local
  guard; see [mitigation details](BRACES_SECURITY_MITIGATION.md).
- Supabase admin clients resolve configuration on use instead of import. Validation
  imports no longer capture missing build-time credentials. Actual hosted access is
  still unverified; SDK transport tests use synthetic hosts and values.
- Registration checks types, lengths, enum values, finite amounts, phone length and
  duplicate fields before privileged access. New profiles explicitly stay unapproved
  and unavailable. Unique-constraint races return the existing-profile state.
  Registration error logging no longer includes DB messages/details or submitted values.
- Directory WhatsApp contact is free, reads only approved workers, is bounded and
  private/no-store, and makes no payment/session/contact-attempt writes. Employer
  copy reflects free contact and does not claim approval establishes availability.
  Historical payment and entitlement rows are not migrated or removed.
- Analytics bounds streamed JSON to 4 KiB, rejects cross-origin browser requests,
  allowlists metadata and redacts query/fragment values and dynamic route identities.
  Caller-supplied payment/activation success events are rejected. This is input and
  privacy protection, **not** durable rate limiting or authoritative conversion data.
- `LEGACY_WORKER_EDIT_ENABLED=false` and `LEGACY_CHECKOUT_ENABLED=false` by default:
  previously exposed edit tokens cannot resolve profiles/boost authority; all four
  legacy checkout entry points deny new sales before external access. Gates must stay
  false pending separately reviewed recovery and entitlement/payment acceptance.
  Legacy Stripe webhooks remain unchanged for historical payment reconciliation.
- Legacy outcome submission performs no write and does not report success. Request
  IDs and selected audience values are not participant authentication. UI states that
  no answer was recorded; a future verified participant flow is still required.
- The **unapplied** privacy candidate now enables contact RLS, revokes direct client
  contact mutations (including column grants), applies restrictive deny-write guards,
  and aborts on inherited writes. This avoids forging both participants' answers and
  bypassing legacy stats-trigger permissions. Existing service-role grants and owner
  contact reads are preserved. No legacy trigger was elevated to security definer.
- Read-only preflight adds catalog column types and transaction identity/timeouts.
  It exports neither column defaults, stored data values, function bodies nor passwords.
  Actual live migration reconciliation remains blocked; fixtures cannot establish it.

## Verification evidence

- Final verification after clean `npm ci`: **56 passed, 0 failed** on Node 24, including six braces regression groups and isolated PGlite migrations,
  rollback on inherited grants, client mutation denial, approved-only contact, registration
  bounds, legacy gates, telemetry privacy, image normalization and admin authorization.
- `npm run lint`: passed with zero warnings; `npm run typecheck`: passed.
- `npm run build`: passed on Node 24 with Next 15.5.27, generating 163 pages.
- `npm run smoke:foundation`: public routes 200; all four admin pages deny access,
  including middleware-bypass probes; no phone-only edit recovery; legacy edit/checkout
  and availability gates deny; outcome UI does not claim a write; local optimizer
  returns 404 for local/remote sources at widths 640 and 3840.
- `npm run security:check`: passed Node/manifest checks and repository/browser scans;
  66 browser JS chunks contain no detected embedded credentials or server-secret
  variable references. Pattern scanning is not proof that arbitrary secrets cannot exist.
- `npm audit --omit=dev`: **0 vulnerabilities**. Full audit: **7 high entries**, all
  deriving from **GHSA-vfj7-8cjw-p6xm** in `braces@3.0.3` via Tailwind/ESLint glob tooling.
  Registry reports 3.0.3 as latest; no patched version is available. A hash-verified
  local patch caps parser nesting and validates AST depth iteratively before recursive
  walkers. Install applies it; build/lint/test/typecheck/dev/security commands verify
  it. Six exploit/compatibility/tamper regression groups pass. These are build-time
  dependencies, not exposed by a production endpoint; builds accept only repository-owned
  patterns. Full npm audit remains **not clean**: published metadata cannot reflect
  the installed-byte mitigation, and no advisory is suppressed or version falsified.
- `npm run test:e2e:request`: **42 passed** in desktop/mobile-emulated Chromium.
  Browser success states and SQL fixtures do not claim hosted Supabase/Stripe acceptance.

Initial failures were fixed rather than waived: Next request-store test initialization,
async client page migration, an ES5-target Set iteration, eager Supabase client capture,
and stale PostCSS lock resolution. Sandboxed webpack failed without diagnostics;
compilation succeeded outside the sandbox. The final security scan's read-only Git
subprocess was also sandbox-blocked; the permitted rerun passed, scanning 1,666
repository files and 66 browser chunks. Build and standalone typecheck are run
sequentially because Next regenerates `.next/types` during compilation.

## Remaining production acceptance blockers

1. **Database authentication and live reconciliation:** authorized auditor connection
   unavailable; deployed columns, policies, inherited grants, views/RPCs/triggers,
   migration ledger and normalized-phone uniqueness are not reconciled. Historical
   anonymous private-column/unapproved-row exposure remains unresolved in production.
2. **Hosted safety acceptance:** production-equivalent synthetic Supabase staging,
   actual PostgREST/RLS/storage tests, verified admin configuration, backup/forward-repair
   evidence and reviewed migration approval are absent. Legacy token incident/recovery,
   verified participant ownership, scoped outcome mutation, durable abuse controls and
   consent evidence must be accepted before their corresponding gates can open.
3. **Contract/payment acceptance:** verified opportunity publishing/YES-NO lifecycle and
   RD$299 Express fulfillment are not implemented/accepted. Provider consent, payment
   currency/settlement, transfer verification, remedies and existing paid-entitlement
   treatment remain unresolved. Historical Stripe webhook/storage flows lack real
   sandbox regressions. Disabled sales and outcome routes are containment, not completion
   of those release requirements.
4. **Upstream dependency finding:** npm still reports seven high entries for braces
   because there is no fixed published release. The local recursion mitigation is
   tested and enforced, but cannot provide upstream-fix provenance or a clean raw
   npm audit. Remove the workaround only after a supported fix passes equivalent tests.
5. **Hosting/image acceptance:** current Vercel connector lists no accessible ListoRD
   project or teams; fresh project usage, deployment pause and hosted Node setting cannot
   be independently confirmed. Optimizer bypass/normalized photo delivery are verified
   locally only; hosted image/storage headers and post-release usage remain unverified.

No operator action or credentials are requested by this checkpoint. Do not replay
`schema.sql`, seeds or all historical migrations. Do not enable any gate, run production
SQL, contact workers or deploy on the strength of local test results.

References: [Next 15 upgrade](https://nextjs.org/docs/app/guides/upgrading/version-15),
[Next support policy](https://nextjs.org/support-policy),
[image usage controls](https://vercel.com/docs/image-optimization/managing-image-optimization-costs),
[braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
