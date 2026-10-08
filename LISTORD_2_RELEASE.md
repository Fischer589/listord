# ListoRD 2.0 release contract

**Scope:** service + location → dynamic scope → structured opportunity → suitable
match → qualified YES/NO → contextual WhatsApp. Two sides, free worker discovery,
existing production data preserved. Express: RD$299 per request, one-time. No
additional tiers, subscriptions or unrelated dashboards.

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

- Phase 2A: anonymous service/location entry, all 14 category schemas, editable
  Spanish preview and explicit copy; local draft only. Implementation day 2:
  2026-10-08. No payments implemented. See the progress log for verification.

- Phase 2B: bounded server validation and real worker query, conservative eligibility,
  exact complete-result counts, private results, free contextual handoff and disabled
  RD$299 Express card. No production data changes or payment implementation.

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

- Worker-side service/location entry; persist/reuse the completed employer draft
  with verified ownership and server validation for later matching/publication.
- Extend verified request ownership/reuse beyond the current draft; the new matching
  path has free contextual contact. Remove legacy directory contact paywalls and
  paid ranking/sales safely while preserving financial records/entitlements.
- Public, moderated opportunities with verified ownership, explicit publication
  consent, complete decision terms, interest/decline and lifecycle handling.
- Verified worker activity/availability renewal: current matching conservatively
  excludes profiles older than 30 days because no confirmation timestamp exists.
  Add supported schedule/qualification evidence; do not treat compatibility as
  confirmed interest. Safe moderation/reporting and lifecycle remain required.
- Mobile/keyboard verification, focus/error handling, source-image performance,
  SEO and private timing/abandonment/zero-result metrics for the core journey.

- Express RD$299 one-time offer after real eligible matching; distinguish compatible
  profiles from confirmed interest. No charges without deliverable outreach.
- Stripe hosted card checkout with verified currency/settlement and any conversion
  disclosed; signed paid webhooks and duplicate-charge/fulfillment protection.
- Manual WhatsApp transfer inquiry with unique reference, PAYMENT_PENDING state,
  audited admin receipt confirmation; no unverified banking instructions.
- Consented automated outreach, worker YES/NO, employer updates/shortlist and
  contextual WhatsApp; minimal admin payment/failure/refund/revenue controls.
- Disclosed fulfillment window and no-response remedy; no hire guarantee.

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
- Matching cannot verify live counts without Supabase configuration. Repository
  schema lacks activity/availability renewal evidence; new results explicitly
  exclude old/unknown records rather than inventing availability. Production
  eligibility, consent/reachability and anti-abuse acceptance remain blocked.
- The team deployment pause was reported during the usage audit. Its resolution
  has not been established; no deployment attempted.
- Full marketplace browser/mobile acceptance and real storage/payment regressions
  are pending. Express provider/consent, verified transfer contact, Stripe account
  currency/settlement and fulfillment/remedy terms remain unverified. Payments
  were intentionally not implemented in Phase 2A.

## Verification status

Baseline: six image tests, typecheck and production build passed. Lint was absent.
Current foundation: 16 photo/admin/database tests, typecheck, lint and production
build pass. Local HTTP smoke checks pass; details are in the progress log. Next runtime
test initialization and Supabase raw upload-error handling were corrected and
regression-tested. Production storage, RLS and payments remain unverified.

Phase 2A: all five unit/regression test files pass; 18 new schema tests pass.
Lint, typecheck and production build pass (164 pages). All 30 request-flow browser
cases pass in desktop/mobile-emulated Chromium, plus two targeted viewport checks.
Physical-device/Safari and full marketplace acceptance remain pending.

Phase 2B: all six unit/regression files pass; six new matching/HTTP test groups
pass. Lint, typecheck and production build pass (166 generated pages). All 36
desktop/mobile Chromium cases pass. Matching tests use controlled records and SDK
transport fixtures; no production inventory/count or live policy validation claimed.

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
- [ ] Express card and manual transfer paths converge on idempotent verified-paid
      fulfillment; no checkout when outreach cannot be delivered.
- [ ] Consented invitations, genuine responses, shortlist, employer updates, refund/
      no-response handling and authorized admin operations pass sandbox E2E.
- [ ] Paid visibility is absent from matching; no unintended new charges.
- [ ] Authorization, abuse controls, lifecycle and stale availability pass tests.
- [ ] Tests, lint, typecheck, production build, mobile/keyboard and core E2E pass.
- [ ] Private funnel metrics measure relevant-match, decision and contact times.
- [ ] Backups, rollback plan, migration approval and deployment approval recorded.

## Next smallest vertical slice

Phase 2C: implement verified worker activity/availability renewal and stale-state
handling, starting with the read-only live schema/policy preflight. Prepare and
stage-test any additive timestamp/state migration; production execution needs
approval. Replace the conservative creation-age gate only after renewal is verified.
Secure employer request persistence/ownership, opportunity responses and Express
payment/fulfillment remain subsequent release slices. Do not activate charges.

Planned active-day budget: days 1–3 foundation/P0; 4–6 request engine/entry;
7–9 discovery/contact; 10–12 opportunities/interest/lifecycle; 13–14 acceptance.
Days 15–21 are for release-critical defects and the release decision only.
