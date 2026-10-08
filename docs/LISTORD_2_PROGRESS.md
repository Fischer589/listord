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
