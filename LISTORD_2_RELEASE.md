# ListoRD 2.0 release contract

**Scope:** service + location → dynamic scope → structured opportunity → suitable
match → qualified YES/NO → contextual WhatsApp. Two sides, free worker discovery,
existing production data preserved. No new subscriptions, prices or dashboards.

**Timebox:** target 14 active development days; release/no-release decision no
later than active day 21. Day 1 is 2026-10-07 (audit/foundation). Count dates with
actual implementation or verification, not messages or idle days. Safety failures
produce a no-release decision, not an indefinite rebuild. After acceptance, stop
feature work and prepare the explicitly approved deployment.

## Completed milestones

- Image usage audit and global optimizer bypass: `d3ca14f` (local, not deployed).
  The October traffic spike's source is unproven; historical logs unavailable.
- Architecture/data-risk audit and ordered plan: `74a455e`.
- Foundation checkpoint: upload-time photo normalization, access-boundary repairs,
  additive marketplace SQL tested on isolated Postgres (not applied to production).
  See `docs/LISTORD_2_PROGRESS.md` for verification details.

## Remaining release-critical work

**P0 — safe release**

- Inspect live schema, worker column grants/RLS, accounts and storage using the
  read-only preflight. Public whole-row worker access may expose phone/edit-token
  columns. Prepare a compatibility-safe privacy migration and assess whether
  token rotation is necessary; never rotate or delete records without approval.
- Verify admin credentials before deploying fail-closed guards; implement secure
  worker/employer ownership and recovery without phone-only account claims.
- Review and patch vulnerable runtime dependencies; verify Vercel Node 24 parity.
  After patching the new Sharp dependency, installation reports 22 dependency
  vulnerabilities (1 critical, 17 high, 2 moderate, 2 low). Next remains 14.2.3;
  it needs a separately verified supported-version upgrade, not a blind audit fix.
- Bound and validate registration/contact/analytics inputs, enforce durable spam
  and duplicate protection, and verify privileged mutations and private analytics.
- Obtain explicit approval for production migrations/deployment after backup and
  staging tests. Test real Supabase uploads/RLS, browser flows and Stripe sandbox
  regressions. Preserve financial history and clarify active legacy entitlements.

**P1 — approved 2.0 experience**

- Service/location entry for both sides; one shared versioned request engine for
  the existing 14 categories; reviewed decision card and natural Spanish summary.
- Suitable worker results and contextual contact, reusing known request details;
  remove the basic-contact paywall and paid ranking/sales together safely.
- Public, moderated opportunities with verified ownership, explicit publication
  consent, complete decision terms, interest/decline and lifecycle handling.
- Freshness-aware availability and explainable matching; comparable compensation
  units; truthful trust signals; safe moderation/reporting and empty/error states.
- Mobile/keyboard verification, focus/error handling, source-image performance,
  SEO and private timing/abandonment/zero-result metrics for the core journey.

**P2 — defer to 2.1**

- New taxonomy expansion (including bartending), chat, dashboards beyond existing
  admin needs, automated ranking/AI, new subscription tiers, elaborate animations.
- Bulk recompression of existing photos unless measurements make it release-critical.
  Preserve all existing references and originals; new uploads use the new pipeline.

## Current blockers / verification limits

- No local production Supabase credentials or schema snapshot. No production SQL
  has run. Isolated Postgres fixtures do not prove live policy compatibility.
- Existing paid worker entitlements and account-recovery operations require owner
  confirmation before their production migration. No payment changes activated.
- The team deployment pause was reported during the usage audit. Its resolution
  has not been established; no deployment attempted.
- Browser/mobile acceptance and real storage/payment regressions are pending.

## Verification status

Baseline: six image tests, typecheck and production build passed. Lint was absent.
Current foundation: 16 photo/admin/database tests, typecheck, lint and production
build pass. Local HTTP smoke checks pass; details are in the progress log. Next runtime
test initialization and Supabase raw upload-error handling were corrected and
regression-tested. Production storage, RLS, payments and mobile E2E remain unverified.

## Release acceptance checklist

- [ ] Employer can specify service/location, answer relevant scope questions,
      review suitable workers and reach a contextual contact without a paywall.
- [ ] Worker can explore detailed opportunities without registration and express
      an authorized YES/NO; contact/interest is never recorded as a hire.
- [ ] Public cards expose no exact residential address, phone or ownership token;
      unknown details and budgets are labeled honestly.
- [ ] New photos are decoded, oriented, bounded, compressed, metadata-free and
      served directly; failures retain existing photos; production storage verified.
- [ ] Existing profiles/accounts/payments survive staged and approved migrations.
- [ ] Paid visibility is absent from matching; no unintended new charges.
- [ ] Authorization, abuse controls, lifecycle and stale availability pass tests.
- [ ] Tests, lint, typecheck, production build, mobile/keyboard and core E2E pass.
- [ ] Private funnel metrics measure relevant-match, decision and contact times.
- [ ] Backups, rollback plan, migration approval and deployment approval recorded.

## Next smallest vertical slice

After the foundation checkpoint: Phase 2A, service + location → schema-driven
scope → reviewed request card and Spanish message, using the existing taxonomy.
Verify all 14 schema variants, missing/invalid answers and mobile keyboard flow.
Do not publish legacy employer leads or require registration just to explore.

Planned active-day budget: days 1–3 foundation/P0; 4–6 request engine/entry;
7–9 discovery/contact; 10–12 opportunities/interest/lifecycle; 13–14 acceptance.
Days 15–21 are for release-critical defects and the release decision only.
