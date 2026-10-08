# Phase 2C read-only production findings — 2026-10-08

## Access and limits

Authorized read-only inspection used ListoRD's existing Vercel project metadata
and its public Supabase URL/anonymous key. No service-role key, SQL password or
worker identity/contact/token value was retrieved. No keys appear in this report.
No configuration, worker row, storage object, payment, policy or migration changed.
The configured Vercel production project reports Node 24 and `live: false`; this
metadata alone does not establish the reason or status of any deployment pause.

Only GET/HEAD were sent. PostgreSQL catalog/policy definitions were unavailable
through this access: REST root/OpenAPI returned 401 and `pg_policies` returned 404.
Thus these findings establish **effective anonymous read behavior**, not the
complete underlying RLS/grant definitions or write permissions. Authenticated and
service-role permissions still need the approved read-only SQL preflight.

## Verified results

HEAD aggregate checks at 2026-10-08 13:44:56 UTC:

| Check | HTTP | Exact count |
| --- | --- | --- |
| Approved workers, anonymous visibility | 206 | 378 |
| Unapproved workers, anonymous visibility | 206 | 4 |
| Approved with `available_now=true` | 200 | 0 |
| Phase 2B approved/available/created-within-30-days candidates | 200 | 0 |
| Approved rows selecting `edit_token`, zero-body HEAD | 206 | 378 |
| Approved rows selecting `whatsapp_number`, zero-body HEAD | 206 | 378 |
| Approved rows selecting `user_id`, zero-body HEAD | 206 | 378 |

HEAD selects for `availability_confirmed_at` and `is_active` each returned 400.
Those fields are not usable via the inspected REST interface. No field was added.

At 14:20:19 UTC, the **installed Supabase SDK and exact Phase 2B select/filter/count
query** returned HTTP 200, exact count 0 and zero records. Its public projection
is compatible with the live REST schema. Running the actual matching function for
Limpieza / Puerto Plata on that result yielded 0. Because the entire candidate
pool is empty, no request can truthfully advertise an eligible current match under
this rule. This is not proof that nobody wants work; it means no approved row
currently declares availability. No availability was invented or backfilled.

## Release-critical security findings

Anonymous access is broader than the intended public projection: it permits
selecting authorization-token/contact/owner columns and includes unapproved rows.
HEAD avoids retrieving private values, but the successful selects are sufficient
to treat legacy edit tokens as potentially exposed. They must not authorize new
private availability links. Existing profile editing/boost operations using them
remain a separate security blocker. Also found in code: page-view tracking included
full query strings, including edit tokens. This checkpoint removes query strings
from that tracking and sets no-referrer headers on worker routes; historical logs
and tokens still require an approved incident assessment/rotation plan.

Vercel project environment metadata did not list ADMIN_USERNAME, ADMIN_PASSWORD
or ADMIN_SESSION_SECRET. Confirm intended admin configuration before enabling
new server-side administration; no credentials were created or changed here.

## Safe next production steps (not executed)

1. Obtain authorized read-only SQL results from `supabase/preflight_listord_2.sql`
   to establish actual catalog schema, RLS, grants, triggers and private-table access.
2. Prepare a compatibility-tested public worker projection/grant repair and token
   incident/rotation plan, including deployed old clients and financial integrations.
   Obtain explicit migration/rotation approval; never silently invalidate accounts.
3. Stage the additive `202610081400_worker_availability.sql` migration and private
   access issuance. Verify server-role grants and approved owner verification.
4. Only after reviewed security remediation, approved migration and staging E2E,
   enable WORKER_AVAILABILITY_RENEWAL_ENABLED. It defaults false in code/docs.
5. Issue a new private availability link after actual owner verification; a phone
   string or legacy edit token is not proof. Never bulk-assert availability. Workers
   themselves confirm or pause; matching requires an unexpired 30-day confirmation.

The reusable `scripts/audit-live-matching.ts` accepts a local JSON config path
containing a public URL/anon key and prints only aggregate results. Keep credentials
out of shell history/Git; do not run other tests with production credentials.

## Privacy preparation follow-up (2026-10-08)

No new live database reads or writes in this checkpoint; the counts above remain
historical evidence. Repository history contains an April public SELECT policy
with USING(true) and a later approved-only replacement. That history offers a
possible drift mechanism, not proof of the current live policy definition.

Prepared `supabase/preflight_worker_privacy.sql` and transactional candidate
`202610081600_worker_public_privacy.sql`. Local PostgreSQL fixtures test broad
legacy grants/policies, inherited-grant abort/rollback, private-column denial,
approved-only reads and compatibility with private availability. No hosted staging
credentials are available, so no hosted migration or full Supabase acceptance is
claimed. The legacy contact outcome invoker trigger requires compatibility work
before rollout. Existing potentially exposed edit tokens still need approved
containment/rotation and recovery; column restrictions alone do not revoke them.
See `WORKER_PRIVACY_ACTIVATION.md` for gates, forward recovery and consent pilot.
