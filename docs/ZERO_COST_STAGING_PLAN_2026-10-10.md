# Zero-cost staging plan — 2026-10-10

**Status: proposed only.** No project, branch, variable, account, data, push or
deployment has been created or changed by this plan. Incremental recurring cost
limit: **$0**.

## Decision from the existing inventory

- Supabase organization `Blackthorne Org` (`nstncngnkxrguhspcsnk`) is on Free.
  Only the ListoRD production project (`rkgtykbekaeruyhdmvbo`) is active;
  Spark and DefenderDesk are inactive and belong to other products. The
  production project has zero Supabase branches and an empty migration ledger.
- A branch is not the zero-cost route. [Supabase branching requires Pro](https://supabase.com/docs/guides/deployment),
  and the organization-specific branch quote is **$0.01344/hour** in addition
  to the plan. [A branch can lack schema when main has no migration history](https://supabase.com/docs/guides/troubleshooting/new-branch-doesnt-copy-database).
  Reusing Spark or DefenderDesk would risk unrelated data and configuration.
- The existing Vercel team `darnellfischer1-3955s-projects` is on Hobby. Its
  ListoRD project has no custom staging target or preview deployment, and its
  production and preview targets share the same ten variable records, including
  Supabase and Stripe credentials. Those preview settings are unsafe for
  synthetic testing. [Vercel Hobby restricts commercial deployments](https://vercel.com/docs/limits/fair-use-guidelines)
  and [does not permit penetration testing](https://vercel.com/kb/guide/penetration-testing-on-vercel).
  This plan does not deploy the payment-capable app or run security probes on
  that team.

## Proposed zero-cost setup

1. **One new Free Supabase project** named `listord-synthetic-staging` in
   Blackthorne Org, in `us-east-1` to match production. Use the second active
   Free slot. Supabase MCP quotes **$0/month** for a project in this organization;
   [Free allows two active projects](https://supabase.com/docs/guides/platform/billing-faq).
   If the slot is unavailable because of an owner/admin quota, stop. Do not
   pause, repurpose, transfer or change an existing project to make room.
2. **Local app on Node 24**, bound to localhost, pointed only at the new project.
   Put a temporary local HTTPS reverse proxy in front of it for Express checkout:
   `checkoutParameters` requires an HTTPS `APP_ORIGIN`. Trust the loopback
   certificate on the test machine and configure the staging Auth redirect URL
   for that origin. Store staging credentials in an ignored local file. Do not pull production
   Vercel variables or link this workspace to production for local testing.
   Docker, Supabase CLI and Stripe CLI are not currently installed; use the
   existing Node installation and hosted staging Supabase via MCP/API, and add
   a free local helper only if a specific test requires it.
3. **Schema and data:** inspect the new empty project's catalog; prepare a
   schema-only baseline from `supabase/schema.sql` without its inline worker
   inserts, then apply only the reviewed additive migrations in dependency
   order. The repo baseline is not assumed equal to the live production schema;
   record any mismatch as a release blocker. Seed invented workers across all
   14 categories and availability/consent/approval states, invented employers
   and opportunities, test Auth users, private legacy-entitlement cases, and
   test images. Use operator-owned test inboxes and WhatsApp test recipients
   only. No production customer export, real phone, real photo or live receipt.
4. **Staging-only variables:** set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the new project; put its
   `SUPABASE_SERVICE_ROLE_KEY` server-side only. Set
   `NEXT_PUBLIC_APP_URL` and `APP_ORIGIN` to the local HTTPS origin, use a staging
   admin account/session secret, and create only a staging `worker-photos`
   bucket. Keep `LEGACY_WORKER_EDIT_ENABLED`, `LEGACY_CHECKOUT_ENABLED`,
   `WORKER_AVAILABILITY_RENEWAL_ENABLED`, `MARKETPLACE_ENABLED` and
   `EXPRESS_ENABLED` false until each relevant staging gate is ready for its
   controlled test. Verify project ref and Stripe key prefix before every
   state-changing test; fail closed if either points to production/live mode.
5. **Stripe and outreach:** use an existing Stripe account's sandbox with
   `sk_test_`/`pk_test_` keys, a test webhook signing secret, test cards and
   test price IDs only. Forward test webhooks to the local handler using a
   temporary Stripe CLI listener. Express uses an inline RD$299 DOP amount;
   verify the sandbox account accepts that currency before enabling its test
   checkout. [Stripe sandbox transactions move no money](https://docs.stripe.com/testing).
   For provider acceptance, use [Meta's free test number and sandbox](https://whatsappbusiness.com/developers/developer-hub/),
   an approved test template and explicitly opted-in operator test recipients.
   If that account/template is unavailable, keep outreach and remedy rows
   blocked; never substitute the live business number.

## Expected cost

| Item | Incremental monthly cost | Limit |
| --- | ---: | --- |
| Supabase Free project | $0 | Second active Free slot; [Free quotas](https://supabase.com/docs/guides/platform/billing-on-supabase) apply |
| Local Node app and existing machine | $0 | No hosted Vercel runtime |
| Stripe sandbox and Meta test setup | $0 | Requires access to existing accounts; no live charges/messages |
| **Planned incremental recurring total** | **$0** | No plan upgrades, add-ons or purchases |

Do not use a Supabase branch: at 730 hours its quoted compute alone would be
**$9.81/month**, and the required Pro upgrade would add a subscription. Do not
upgrade the Vercel Hobby team. If any free-tier quota or provider setup requires
a paid change, stop and report the blocker.

## Acceptance coverage and remaining gaps

The separate hosted Supabase project plus local app can exercise real database
schema, grants/RLS/PostgREST, Auth token checks, storage uploads, worker and
opportunity lifecycle, matching, budgets, Express quote, Stripe test checkout
and signed webhook replay, admin authorization, and synthetic legacy finance.
Meta sandbox delivery can cover provider acceptance if a test template and
recipients are available. Record evidence by row in the
[hosted matrix](HOSTED_ACCEPTANCE_2026-10-10.md); local browser behavior does
not count as Vercel-hosted evidence.

The following cannot be marked fully hosted PASS under this plan:

- **Vercel hosting:** actual deployed Node 24 runtime, deployment headers,
  protected preview behavior, source-image/cache behavior, hosted webhook
  reachability, and device checks against a deployed staging URL.
- **Email-code delivery:** [new Free Supabase projects cannot customize the
  default email template without custom SMTP](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).
  The built-in SMTP also sends only to organization-member addresses at a
  [small rate limit](https://supabase.com/docs/guides/auth/auth-smtp). Auth token
  security can be tested, but the exact code-email flow needs an existing free
  custom SMTP provider or remains blocked.
- **External operations:** any missing Meta test account/template, real DOP
  settlement behavior, actual bank receipt/refund evidence, and ongoing operator
  dispatch/deadline coverage remain separate evidence and decisions.

## Single authorization decision

Authorize creation of **one $0 Free Supabase project in Blackthorne Org** and
use of that project for synthetic local acceptance, with no Vercel deployment,
production data access, live payment/message, plan upgrade, push or purchase.
