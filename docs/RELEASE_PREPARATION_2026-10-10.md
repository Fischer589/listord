# ListoRD 2.0 release checkpoint — 2026-10-10

Decision: **BLOCKED** for production release. Resumed from `37cd930`, preserved
and completed the pending marketplace/Express implementation in the working tree.
This report supersedes older statements that these features were not implemented.
Local evidence does not establish production acceptance or authorize activation.

## Repository work completed

- Anonymous category-specific intake for all 14 existing services, complete Spanish
  terms, budget/unit distinction, real eligible matching and free contextual contact.
  Verified owners can reuse their persisted request terms into an editable new draft;
  reuse never silently republishes a request or copies its private contact information.
- Public opportunity browsing and service/city filters before verification. Publication
  requires a verified Auth account, private contact, explicit consent and moderation
  of every public field. No automatic publication of old employer leads.
- Transactional YES/NO/change/withdrawal, self-response and wrong-owner denial,
  expiry/closed/filled enforcement, private current-YES contacts and owner shortlist.
  Interest, provider acceptance, WhatsApp contact and owner-marked coverage never
  update historical hire statistics. Closed/expired responses can still be withdrawn.
- Tab-scoped Auth sessions survive client navigation, reload and payment return;
  sign-out clears them. Server mutations verify the access token with Auth, not
  browser metadata or phone numbers. Existing profile ownership requires audited,
  independent operator verification; linking never approves or activates workers.
- Moderation, privacy reporting/removal, bounded participant writes and separate
  revocable Express messaging consent. New private tables have RLS and no direct
  anonymous/authenticated grants; service RPCs use a pinned search path.
- RD$299 Express preparation: pre-payment compatible/consented/reachable recipient
  quote, eligibility recheck, one order per opportunity, Stripe hosted one-time DOP
  checkout, stable idempotency and signed paid amount/currency/reference checks.
  A manually confirmed transfer uses the same ledger and fulfillment boundary.
  Existing YES/NO responses exclude a worker from paid outreach.
- Durable invitation claims precede provider calls. An operator starts a bounded
  batch of approved WhatsApp templates. Later batches resume only unclaimed
  invitations. A timeout or missing DB acknowledgment never automatically resends
  an uncertain invitation. Provider acceptance is not delivery or interest.
- Genuine responses reconcile the Express ledger; no valid YES by the disclosed
  deadline, opportunity closure or loss of consent leads to a remedy state on status
  reconciliation. Owners can refresh status/shortlist; operators have payment,
  dispatch, deadline and receipt/refund controls. A refund is recorded only after
  an operator confirms external refund evidence. No live refund/charge was initiated.
- Historical premium webhook replay cannot extend/overwrite existing entitlements;
  unpaid events cannot grant access. Legacy return URLs are read-only and cannot
  synthesize renewed access from an expired checkout. Phone/browser-ID entitlement
  lookup is denied. Historical rows and signed reconciliation remain intact.
- Removed paid boost ordering, paid badges and contact paywall sales from directory
  discovery/contact. Shared free handoff validates WhatsApp destinations. Unknown
  availability is labeled honestly. Photo elements, source URLs and upload pipeline
  remain intact.
- An additive write-budget candidate caps 2.0 registrations per normalized-phone
  HMAC and globally, plus global telemetry writes. Missing budget service fails
  closed when the marketplace gate is on. A normalized-phone unique index aborts
  on legacy duplicates instead of deleting/merging them. No production index ran.
- Private, bounded funnel events cover intake/preview/abandonment, match counts
  (including zero), time to results and contact. They exclude request text/contacts
  and remain untrusted telemetry, separate from authoritative SQL/payment events.
- Bounded raw webhook body; bounded homepage DB fetch; generic public DB errors;
  no-store/referrer protections, admin authorization and browser-secret scans.

## Verification evidence

Final command results are recorded below after the complete verification run.
Browser transport fixtures and PGlite SQL fixtures are synthetic. Neither proves
hosted PostgREST/RLS, Auth email delivery, storage, Stripe or provider acceptance.
Physical devices/Safari are not claimed by mobile Chromium emulation.

- Node **24.21.0**; production build **Next 15.5.27**.
- `npm test`: **69 passed, 0 failed**, including real webhook-handler signature/
  session binding and replay tests, SQL lifecycle/budget/uniqueness fixtures,
  preserved photo tests and SDK deadline/cancellation regression.
- Desktop/mobile Chromium: **52 passed, 0 failed**, including all 14 category
  previews in each viewport, matching, verified decisions, shortlist, contact and
  tab session reuse. Playwright builds with synthetic public Auth values and blank
  privileged credentials before starting its isolated server.
- `npm run lint`: passed with zero warnings. `npm run typecheck`: passed.
- `npm run build`: passed, **167 generated pages**; optimizer bypass preserved.
- `npm run security:check`: passed; **1,696 repository files and 76 browser JS
  chunks** scanned, no detected embedded credentials or server-secret references.
  Pattern scanning is not proof that every possible secret is absent.
- `npm run smoke:foundation`: passed public routes, seven admin page/API guards
  including middleware bypass, disabled edit/sales/availability/outcome containment,
  legacy contact redirect to the free profile, honest registration approval copy,
  and local/remote optimizer denial at both tested widths.
- `git diff --check`: passed.
- `npm audit --omit=dev`: **0 vulnerabilities**.
- Full `npm audit`: **7 high entries**, all from the known braces recursion advisory.
  The installed-byte, hash-verified mitigation and exploit tests remain enforced.
  There is no clean raw audit or upstream-patched provenance; no advisory suppressed.

Verified issues found during this work were fixed, not waived: legacy entitlement
return writes/phone lookup, paid directory ordering, navigation losing login,
recipient quote ordering, directory retry deadlines/caller cancellation, and one React effect warning.
The final pass also removed a stale paid contact form and an unapproved-profile
visibility/share claim. Browser fixture setup now rebuilds with synthetic public
Auth configuration so a clean production build cannot silently invalidate tests.
The initial workspace Node 20 run was not accepted: Node 24 reruns replaced it.
Sandbox denial of local sockets/Git subprocesses required permitted local reruns.

## Exact remaining blockers — external access and acceptance

1. **Live database/privacy reconciliation.** The authorized auditor connection is
   still unavailable. Prior evidence of public private-column/unapproved-row access
   has not been remediated in production. Need actual catalogs/grants/inheritance,
   views/RPCs/triggers, migration ledger and normalized-phone duplicate inventory.
   Auditor TLS/configuration/passwords/roles were untouched. No support wait was
   used to defer repository work.
2. **Hosted Supabase safety acceptance.** Need an authorized production-equivalent
   synthetic staging project for selected migrations, real PostgREST column/RLS
   probes, Auth OTP template/delivery/rate-limit configuration, independently verified
   ownership linking, admin credentials, storage upload/header/rollback checks and
   backup/forward-repair evidence. Existing legacy outcome submission stays disabled;
   this release records opportunity decisions, not unverified historical hire claims.
3. **Incident and legacy entitlement decisions.** The owner must accept containment/
   recovery of exposed old edit tokens and historical logs, and reconcile active
   paid ranking/subscription commitments/refunds. Code preserves records and stops
   new sales; it cannot invent a production entitlement policy or verify its holders.
4. **Express account and operating acceptance.** Need actual Stripe sandbox evidence
   for the account's DOP presentment/settlement/conversion behavior, signed webhook
   replay and historical payments. Need verified transfer contact/receipt procedure,
   approved WhatsApp template/provider/account and real opt-in/reachability evidence.
   The proposed 24-hour/full-refund terms and operator batch/monitoring/refund coverage
   require acceptance. There is no unattended scheduler activated. Uncertain sends
   require provider receipt investigation or remedy, not guessed retries. Pending
   checkout retries are bounded to 30 minutes; expired/uncertain orders require
   reconciliation rather than a second automatic charge.
5. **Upstream audit finding.** Seven high build-tool entries remain in npm metadata.
   Local mitigation passes; upstream remediation/security acceptance remains open.
6. **Hosting and authorization.** Accessible ListoRD Vercel project/team, actual
   Node 24 configuration, deployment-pause resolution, live source-image/cache
   behavior and physical-device acceptance remain unverified. Production migration,
   worker activation, outbound messages, live charges, push and deployment still
   require explicit authorization.

There is no known failing repository check once the final results below pass.
That statement is limited to tested local behavior, not a claim that production is
secure or that external payment/fulfillment acceptance is complete.

## Prepared migration and operational handoff

Do not replay schema/seeds/history. Reconcile each candidate with the live catalog.
Review the prior foundation (`202610071200`), availability (`202610081400`) and
privacy (`202610081600`) candidates, then the new lifecycle (`202610091200`),
Express (`202610091300`) and ingestion-budget (`202610101200`) candidates. Check
actual filenames/ledger before selecting order; synthetic lifecycle tests use a
minimal worker/availability fixture, not the deployed schema. Failed candidate
transactions roll back; legacy duplicates require reviewed resolution, not cleanup.

Keep `MARKETPLACE_ENABLED`, `EXPRESS_ENABLED`, availability renewal and both legacy
gates false. Express also requires the exact terms attestation, settlement and
provider attestations; populating credentials alone never enables it. No gates,
provider templates, bank instructions, contacts or secrets were configured here.
The byte cap and default-off routes are containment, not external acceptance.

Photo safeguards: [pipeline](PHOTO_PIPELINE.md). Privacy incident/staging:
[runbook](WORKER_PRIVACY_ACTIVATION.md). Dependency finding:
[mitigation](BRACES_SECURITY_MITIGATION.md).
Stripe lists DOP presentment and distinguishes it from settlement; that does not
verify this account: [Stripe currency documentation](https://docs.stripe.com/currencies).
The email OTP UI requires a template containing the code:
[Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

**One concrete next action:** run the selected migration/Auth/storage acceptance
[matrix](HOSTED_ACCEPTANCE_2026-10-10.md) in an authorized synthetic hosted Supabase staging project, independently
of the production auditor/support issue. Keep production and all activation gates
unchanged until the evidence and approvals above exist.
