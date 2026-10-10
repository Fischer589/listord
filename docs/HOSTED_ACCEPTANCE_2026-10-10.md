# Hosted acceptance matrix — prepared, not executed

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
