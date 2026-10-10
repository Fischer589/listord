# Hosted acceptance matrix — prepared, not executed

## Access check — 2026-10-10 continuation

**Hosted status: BLOCKED for every row below.** No authorized synthetic Supabase
staging project, connection, or credentials are available in this workspace or
connected accounts. The existing production auditor service was retried read-only;
authentication stopped it before any SQL executed (`fe_sendauth: no password
supplied`). Its TLS, role and configuration were not changed. The available Vercel
account returned no ListoRD project or team. No Stripe test account or WhatsApp
provider account/template was connected. No hosted migration, Auth request,
storage upload, checkout, webhook delivery, provider message, refund or deployment
was attempted.

Local synthetic fixtures remain evidence only for repository behavior. Record a
real staging project reference, approved operator, selected migration ledger and
redacted results against each row before changing any release gate. Do not turn
the local passes into hosted PASS statuses.

**Recheck from `756d775`:** the Supabase integration is available but still
unconnected, the accessible Vercel account lists no ListoRD project, and the
workspace has no staging service configuration. No matrix row was executed.
Node 24 local gates passed again: 69 unit/integration tests, 52 desktop/mobile
Chromium cases, lint, typecheck, 167-page fixture-free build and security scan.
These results do not replace the hosted checks or owner decisions below.

**Recheck from `0ff1b99` (2026-10-10):** the owner reported connecting Supabase,
but the integration catalog in this session still returned `installed: false` and
exposed no Supabase tools or staging project handle. No staging environment variables
were present. The only previously identified PostgreSQL service is the production
auditor connection, which was not used for this acceptance attempt. Therefore no
project identity could be verified and **every hosted row remains BLOCKED**; no
hosted data or infrastructure was changed. Node 24 local verification passed:
69 unit/integration tests, 52 desktop/mobile Chromium cases, lint, typecheck,
fixture-free production build (167 static pages), and security scan. The full npm
audit still reports seven high development-tool entries from the unpatched `braces`
advisory; the production-only audit reports zero. See
[the mitigation record](BRACES_SECURITY_MITIGATION.md). The next owner action is to
attach the existing authorized synthetic Supabase staging project to this session
so its project handle and tools become available for identity verification.

Use an authorized **synthetic staging** Supabase project and Stripe test account.
No production export, outreach, charge, SQL, activation or deployment is authorized
by this document. Keep a record of environment, schema ledger, test timestamp,
operator and redacted evidence. Never put credentials or capability URLs in logs.

Review the live schema separately with `supabase/preflight_worker_privacy.sql`.
Select the foundation, availability, privacy, lifecycle, Express and ingestion-budget
candidates against that ledger; do not replay baseline schema/seeds/history.
The normalized-phone unique index must fail on duplicates without removing records.
Snapshot schema/grants and record backup/forward-repair procedures before approval.

| Boundary | Synthetic exercise | Required evidence |
| --- | --- | --- |
| Auth | Configure email code template, verify, reload, refresh token, sign out | Code works; private mutation rejects unconfirmed/revoked/wrong token; sign-out clears session |
| Ownership | Link independently verified worker; attempt same phone/old token/wrong account/existing-owner replacement | Only audited verified link works; no approval or availability change |
| Public privacy | Anonymous/authenticated REST SELECT/filter/order/embed private columns and unapproved workers; inspect inherited grants/views/RPCs | Denied private columns; no unapproved rows; private marketplace/payment/budget tables inaccessible |
| Intake | Each existing category, unknown/overlong fields, budget units, preview/edit/reuse | Server validation agrees with browser; no private contact copied into terms |
| Publication | Submit consented complete draft, retry, moderate, report/remove | One private draft; no public exposure before review; rejection/removal closes public access |
| Decisions | YES → NO → YES → withdraw; other account/self/expired/closed; owner closes/marks covered | Current decision only; authorized current-YES contact only; no hire-stat mutation |
| Matching | Paused/stale/future/unknown/qualified/zero/DB-error workers | Conservative honest counts; no paid ordering; outage is not zero |
| Photos | Portrait/landscape/EXIF, invalid/oversize, duplicate retry, failed storage/DB association | Bounded metadata-free WebP; old photos preserved; direct URLs/cache headers; optimizer disabled |
| Budgets | Same phone variants concurrently, per-subject/global exhaustion, missing RPC | Unique profile or duplicate state; no uncontrolled writes; telemetry failure does not block contact |
| Express quote | Current availability + consent + reachable recipient; revoked consent/NO/own worker/zero | Exact capped deliverable count before payment; no new checkout for invalid recipients |
| Card | Test hosted RD$299 checkout, cancel, return-before-webhook, duplicate/tampered/wrong amount/currency/reference | No redirect-based activation; one verified paid ledger; account settlement/conversion documented |
| Transfer | Unique reference, inquiry only, wrong amount, reused receipt, audited actual receipt | PAYMENT_PENDING until verified receipt; same fulfillment ledger; no banking instructions inferred |
| Outreach | Approved test template, claim/send/receipt; crash after claim, timeout after provider acceptance | One provider acceptance per claim; no uncertain resend; consent rechecked; no fake YES |
| Response/remedy | Test recipient YES after accepted invitation; NO/no response/closure/deadline; real test refund evidence | Genuine shortlist and state updates; remedy due when required; refund never claimed before evidence |
| Admin | No cookie/wrong cookie, middleware bypass, cross-origin JSON, named operator evidence | Independent server authorization, generic errors, audited private actions |
| Legacy finance | Existing entitlement, late/repeated paid webhook, expired return reference | No overwritten/extended old record from replay; no phone-only read; signed history preserved |
| Hosting | Actual Node 24, build assets/headers, optimizer denial, deployment pause, mobile/Safari | Environment-specific evidence; no inference from localhost |

An operator must explicitly accept coverage for Express batch dispatch, periodic
pending/deadline review, provider-receipt reconciliation and actual refunds. The
repository starts no cron or background worker. Verify that the proposed terms and
30-minute retry/uncertain-payment handling match the approved operating procedure.

Record PASS/FAIL/BLOCKED and redacted evidence per row. Do not replace missing hosted
evidence with a mock response. Production migration/deployment and any real worker
outreach/activation are separate approvals after this acceptance is reviewed.
