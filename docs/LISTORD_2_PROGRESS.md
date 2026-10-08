# ListoRD 2.0 checkpoint log

## Phase 0 — audit and architecture

Completed repository audit and architecture/migration sequence in
`LISTORD_2_ARCHITECTURE.md`. Existing production architecture retained.
Read-only Vercel project metadata checked; no production credentials retrieved.

Verification: 6 image regression tests passed; typecheck passed; production build
passed (163 static pages). No lint configuration existed at this checkpoint.
Warnings: React `fetchPriority`, absent local Supabase configuration. Live data,
payments, actual RLS grants and storage were not verified.

Audit checkpoint: `74a455e`.

## Foundation recovery checkpoint — Phase 1A and retained 1B SQL

Completed the unfinished photo/access foundation as one session subphase.

- New registration/edit photos are content-validated, auto-oriented, bounded to
  800×800 without distortion/upscaling, stripped of metadata and encoded once to
  WebP. Immutable worker-scoped hashes replace phone/filename object keys for new
  uploads. Explicit failures preserve old references. Details: `PHOTO_PIPELINE.md`.
- `images.unoptimized: true` remains. No stored object or production worker row
  was changed. New input cap is 4 MiB to fit the platform request limit.
- Admin middleware and privileged reads/actions fail closed. Phone-only recovery
  and duplicate registration no longer disclose worker edit tokens or names.
  Existing valid edit links still work; public worker props omit phone numbers.
- Added an additive, unapplied marketplace migration: public-safe opportunities,
  private owners/contact, interests and reports; publication consent, expiry,
  moderation, duplicate and access constraints. Original worker/lead/payment rows
  are preserved in isolated tests. No live migration or automatic lead backfill.
- Added lint, TypeScript tests, isolated PGlite/Postgres tests and a localhost
  smoke script. Release scope/timebox is tracked in `../LISTORD_2_RELEASE.md`.

Verification on the final Sharp 0.35.5 dependency: all 16 tests passed;
`npm run typecheck` passed; `npm run lint` passed without warnings/errors;
`npm run build` passed and generated 163 static pages. `git diff --check` passed.
`npm run smoke:foundation` passed against the final local production build:
five public routes returned 200; all four admin data pages required login,
including middleware-bypass probes; phone-only recovery exposed no edit link;
the production manifest retained `unoptimized: true` and `/_next/image` returned
404. The bypass probe can produce a Next streamed login redirect (HTTP 200 with
redirect metadata), which is explicitly checked rather than mistaken for access.
An authorization test initially lacked Next's server runtime setup; fixed and
rerun. Storage retry tests now exercise the installed SDK's raw API error shape
as well as its typed error shape. No failed tests were waived.

Dependency security is NOT clear for release: installation reports 22 known
dependency vulnerabilities, including 1 critical. Sharp was patched during this
checkpoint; existing Next/tooling upgrades remain P0. Other observed warnings:
React `fetchPriority`, missing local Supabase configuration and stale Browserslist
data. Browser/mobile E2E, real storage, live RLS and payment regressions remain
unverified. All SQL files are local only; deployment and migration approval are
still required. No push, deployment or payment activation performed.

Next implementation slice: Phase 2A — service + location → category-specific
scope → reviewed request card/Spanish summary, sharing one engine across the
existing taxonomy. Keep production rollout gated on the P0 release checklist.

## Phase 2A — employer request specification (2026-10-08, active day 2)

Completed one bounded vertical slice from `1b11a47`:

- Homepage “Necesito personal” opens `/solicitar` without registration.
- Existing 14-category taxonomy and Dominican city suggestions drive service +
  location entry. Other municipalities are accepted without changing the taxonomy.
- One versioned schema engine collects category-specific scope and shared timing,
  duration, DOP compensation, exclusions and requirements. Progressive validation
  rejects missing/invalid terms. Unknown timing or price can be explicitly stated.
- Editable Spanish preview labels budgets and negotiable terms honestly. Copying
  is explicit; service/location can be reused in existing profile discovery.
  Common answers survive editing; category changes clear incompatible scope.
- Drafts stay in page memory only, with an explicit copy-before-leaving notice.
  No request publication, worker invitation, matching count or confirmed interest
  is claimed. No addresses are requested; free-text privacy guidance is shown.
- Responsive layout, focus management, linked field errors and keyboard flow.
  Screenshot review led to a scroll offset for the existing sticky header.
- Express RD$299, Stripe card checkout, manual WhatsApp transfer, verified-paid
  fulfillment and notification prerequisites are documented in the architecture
  and release checklist. No payment implementation or activation this session.

Verification:

- `npm test`: all five test files pass (photo/image/admin/isolated database and
  request specification). Direct execution of the new specification test file:
  **18 tests pass**, including all 14 categories, invalid terms, category changes
  and honest summaries. Existing photo safeguards remain covered.
- `npm run lint`: passes without warnings/errors.
- `npm run typecheck`: passes, including browser test/config types.
- `npm run build`: passes, **164 static pages**, `/solicitar` ~102 kB first-load JS.
- `npm run test:e2e:request`: **30 cases pass** against the production build in
  desktop and mobile-emulated Chromium. Covers all 14 category flows on both,
  anonymous entry, validation, focus/keyboard, copy, editing, category reset,
  discovery URL and horizontal overflow. Two targeted reruns also pass after
  adding an explicit preview-heading viewport assertion. Screenshots reviewed.
- Initial browser assertions ambiguously selected Next's route announcer and
  used exact label text around a select; selectors corrected, not waived.
  Sandbox HTTP startup restriction required local execution permission.
- `git diff --check`: passes.

Limits: mobile emulation is not physical-device/Safari coverage. Local Supabase
configuration is absent, so analytics reports skipped events; real DB/storage,
matching, accounts and payments are not verified by this client-only journey.
Dependency audit remains 22 issues (1 critical, 17 high, 2 moderate, 2 low), with
existing runtime remediation still P0. No migration, production data/storage
change, push, deployment, charge or outbound worker message occurred.

Next: Phase 3A — reuse the structured draft for real eligible worker matching,
with server validation and explainable actual counts. Verify existing availability/
inactivity evidence first; do not equate discovery results with confirmed interest.
Stop this session at the Phase 2A checkpoint.

## Phase 2B — real worker matching (2026-10-08, active day 2)

Continued from `40c3178`; no repeat audit or infrastructure rebuild.

- Anonymous request preview now submits the complete versioned draft to a bounded,
  runtime-validated server endpoint. Existing Supabase worker data supplies matches;
  no production fixture or fallback worker is generated.
- Approval and explicit availability are required. Missing, stale/future or
  incomplete records are excluded. Because there is no availability confirmation
  timestamp/activity state in repository schema, eligibility conservatively uses
  a 30-day creation-age bound. Boosts/edits do not refresh it. This is documented
  policy, not proof of current availability or an inferred live-schema field.
- Exact normalized city, explicit trade skills, same-unit known compensation and
  supported scope phrases drive filtering/explanation. Interest, schedule and
  requirements are never treated as confirmed. New sorting ignores payment fields.
- Count covers the complete eligible set. Exact DB count/response consistency and
  a 1,000-row candidate cap reject partial reads with 503, not misleading totals.
  Zero, missing configuration, DB failure and old/unknown profiles are distinct.
- Match responses allowlist public identity/reasons only, with no phone/edit token,
  owner ID or raw database error. No-store responses and bounded request bodies.
- New matching results offer free contextual WhatsApp handoff; the server rereads
  and rechecks eligibility before returning the destination URL. It does not write
  contact/hire/payment records or consult premium entitlements. Phone is disclosed
  only in this explicit handoff, never the match list. Legacy directory paywalls
  and boost sales remain separate release work; their financial history is intact.
- Real count → disabled Express card: RD$299 one-time, future authorized outreach
  and organized interest explained, no hire guarantee, no checkout/payment code.
- Editing clears results and aborts pending work; mobile results support progressive
  display. Existing worker records/photos and image safeguards remain untouched.

Verification:

- `npm test`: all six regression/unit test files pass.
- `node --import tsx tests/request-matching.test.ts`: all **6 new test groups** pass,
  covering eligibility, all category labels, care ambiguity, stale/unknown data,
  compensation units, scope evidence, counts, privacy, partial/error responses,
  runtime validation and both production HTTP handlers through the installed
  Supabase SDK with a controlled fetch transport. No live DB assertion implied.
- `npm run lint`: passes without warnings/errors.
- `npm run typecheck`: passes. Initially found that this SDK requires abortSignal
  before maybeSingle; corrected the chain and verified the handler tests.
- `npm run build`: passes, 166 generated pages; `/solicitar` ~103 kB first-load JS.
- `npm run test:e2e:request`: **36 cases pass** on the production build in desktop
  and mobile-emulated Chromium, including all Phase 2A regression flows and new
  count, disabled checkout, free contact error, edit/reset, zero/error/retry and
  malformed real-route tests. Browser success/zero/error payloads are explicitly
  transport fixtures; production routes are separately exercised in server tests.
- `git diff --check`: passes.

Limits/blockers: no live Supabase credentials/schema inspection, so production
counts/RLS/privacy grants are not verified. Repository schema has no independent
activity status or dated availability renewal; older otherwise-valid profiles may
all be excluded until that is implemented. Durable anti-abuse controls, ownership,
legacy paywall/ranking migration, dependency remediation and Node 24 parity remain
release requirements. Express payments, transfer confirmation, consented provider
outreach, responses and fulfillment/remedy terms remain unimplemented. No push,
deploy, production migration, financial write or outbound message occurred.

Exact next slice: Phase 2C — verify live worker schema/policies read-only, then
implement authorized worker activity/availability renewal with a dedicated timestamp
and stale-state handling. Stage-test any additive migration before requesting
production execution approval; do not replace the conservative gate prematurely.

## Phase 2C — live evidence and gated availability renewal (2026-10-08, active day 2)

Recovered clean checkpoint `246a02a`; initial interrupted work had read metadata
only. Used authorized Vercel metadata/public Supabase configuration for read-only
GET/HEAD checks, not service credentials or production mutations. Full evidence
and exact timestamps: `LIVE_AVAILABILITY_AUDIT.md`.

Verified live findings: 378 approved rows; 4 unapproved rows anonymously visible;
0 approved rows declaring available_now; exact installed-SDK Phase 2B matching
query HTTP 200 with count 0 and zero records. Limpieza/Puerto Plata matching on
that result returned 0. HEAD permits selecting edit-token, phone and owner-ID
columns, without retrieving any of their values. Treat existing tokens as exposed.
SQL catalog/RLS/grant definitions remain unavailable; no claim of a full policy
review or successful production renewal. Temporary public configuration was removed.

Implemented:

- Private availability capability links, separate from untrusted legacy edit
  tokens. Authorized admin must attest actual owner verification before issuance.
  New random 256-bit secrets are delivered as URL fragments and stored only hashed;
  access expires in 180 days, reissue invalidates the predecessor. No messages sent.
- Worker confirmation/pause with no registration or duplicate profile. The private
  capability is checked server-side; DB RPC locks/rechecks approval and records its
  own confirmation time atomically with available_now. Users cannot supply dates.
- Additive private table/RPC migration, tested in isolated Postgres, UNAPPLIED.
  No existing profile/photo/token/payment was backfilled, rotated or removed.
- Default-off WORKER_AVAILABILITY_RENEWAL_ENABLED gates reads/writes/admin UI.
  Default matching retains the conservative creation-age 30-day safeguard. Once
  security/migration acceptance permits activation, matching/contact require a
  fresh explicit confirmation within 30 days plus approval/availability/unexpired
  private access. Stale, future, missing, paused and revoked state fails closed.
- Worker referrers suppressed; page-view analytics excludes all query strings so
  it no longer records edit tokens/phones/payment references from URLs. Historical
  exposure/logs and live grants remain incident-response/release blockers.
- RD$299 Express and free contextual contact preserved; checkout stays disabled.

Verification:

- `npm test`: all **7 regression/unit test files pass**.
- Direct availability suite: all **3 test groups pass**, exercising 30-day boundaries,
  old-profile renewal, authorization/CSRF/gating, server-time writes, private grants,
  no backfill, record/photo preservation, pause, expired/reissued capabilities,
  approved-worker checks, real handlers/SDK with controlled transport and matching.
- A new query fixture initially returned a timestamp later than the query snapshot;
  the future-time safeguard correctly excluded it. Corrected the fixture to respect
  the production query's upper bound, then reran the complete suite successfully.
- `npm run lint`: passes without warnings/errors.
- `npm run typecheck`: passes.
- `npm run build`: passes, 169 generated pages. Availability page ~97.6 kB first-load.
- `npm run test:e2e:request`: **42 cases pass** in desktop/mobile-emulated Chromium,
  including all prior category/matching flows and new renew/pause/invalid-link,
  fragment removal, analytics redaction and no-referrer checks. Test server enables
  the gate locally with the service-role key explicitly blank; browser state tests
  use transport fixtures and cannot mutate the production database.
- `git diff --check`: passes. All image safeguard regressions retained.

Production activation remains BLOCKED: finish authorized SQL policy/grant audit,
repair effective public sensitive-column/unapproved access, assess historical token
exposure/rotation, configure verified admin access, and stage/approve the new
migration and owner-link process. Default gate must remain false until acceptance.
Runtime dependency/Node parity, anti-abuse and other existing P0/P1 checks remain.
No deployment, push, charge, outbound worker message or production migration.

Next milestone: Phase 2C production acceptance — read-only SQL catalog/grants,
compatibility-safe privacy/incident plan and staged migration/authorization tests;
obtain explicit approval before any production changes. Do not expand feature scope.

## 2026-10-08 — Privacy repair candidate and consent-based activation preparation

Continued clean checkpoint `4650db3`; no previous phases repeated or live worker
records accessed/changed. Prior live audit remains the source of the 378 approved,
4 publicly visible unapproved, and zero declared-available counts.

Implemented:

- Transactional, unapplied worker privacy candidate: revoke table and column client
  grants, grant only the existing public query projection, restrictive approved-only
  SELECT and denied client writes. Existing service-role grants are preserved.
- Fail the migration atomically if inherited roles retain sensitive-column or write
  access, or client roles bypass RLS. No token/photo/profile/availability data edits.
- Self-ownership boolean helper for existing authenticated contact-read policies;
  private owner IDs remain unavailable. Identified legacy invoker outcome-trigger
  writes as a hosted staging/rollout dependency; not silently elevated.
- Read-only SQL catalog preflight covering roles, grants, policies, views/functions
  and triggers. Actual live definitions and hosted staging access remain unavailable.
- Separate server-enforced link-delivery consent and owner-verification attestations
  in admin issuance. Worker confirmation remains explicit, fresh for 30 days, with
  no bulk activation or automatic messages. Existing private-link/photo guards stay.
- `docs/WORKER_PRIVACY_ACTIVATION.md`: staging gates, forward recovery, exposed-token
  incident/recovery requirements and an inbound-first, consent-based activation pilot.
  No claim that approved profiles consented to outreach or are currently available.

Verification in this checkpoint:

- `npm test`: **44 tests pass**, including new isolated PostgreSQL privacy, inherited
  grant rejection/rollback, untouched records/photos, anonymous/authenticated private
  column denial (including filters/order), unapproved exclusions, owner contact reads,
  service-role free contact and explicit renew/pause. Admin/CSRF, consent, expiry,
  matching, upload normalization and existing regression tests pass.
- `npm run lint`: pass, no warnings/errors.
- `npm run typecheck`: pass after correcting types in the new SQL test fixtures.
- `npm run build`: pass, 169 generated pages.
- `npm run test:e2e:request`: **42 desktop/mobile Chromium cases pass** against the
  local production build, with service-role configuration explicitly blank.
- `git diff --check`: pass. Expected missing local Supabase configuration and
  existing React fetchPriority/color-environment test warnings do not fail checks.
- Rechecked the photo doctrine against `lib/worker-photo.ts` and
  `docs/PHOTO_PIPELINE.md`: varying dimensions, content validation, EXIF orientation,
  bounded 800×800 WebP, metadata removal, deterministic worker-scoped storage and
  direct responsive delivery remain intact. Existing photo references are untouched;
  Vercel optimizer bypass remains enabled. Live storage/caching/Node 24 acceptance
  and any legacy-photo backfill require the documented safe inventory/staging plan.

No hosted staging validation, production migration, deployment, worker message,
activation, token rotation, push or charge occurred. RD$299 Express stays disabled.
Remaining blockers: authorized live SQL catalog results, hosted Supabase acceptance,
legacy outcome trigger permissions, exposed-token containment/recovery, verified
admin configuration and consent evidence. Existing dependency/abuse/storage P0s
remain in the release checklist. This checkpoint prepares the privacy repair; it
**does not establish that production access is secure**.

Exact next milestone: reconcile the candidate with authorized catalog findings,
resolve compatibility/incident gates and validate in hosted Supabase staging; obtain
explicit approval before production remediation or the consent-based activation pilot.
