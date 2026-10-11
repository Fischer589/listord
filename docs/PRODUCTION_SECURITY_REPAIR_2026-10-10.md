# Production security repair record — 2026-10-10 EDT

**2026-10-11 update:** The fail-closed outcome and contact API hotfix is live,
and the reviewed additive 2.0 schema package is applied. See the
[current production handoff](PRODUCTION_RELEASE_HANDOFF_2026-10-11.md).

Project: Blackthorne Org / Supabase `rkgtykbekaeruyhdmvbo`. The owner waived a
newly verified backup for this repair window. No database password was reset,
no worker or contact row was selected for this review, and no app was deployed.

## Applied: legacy privileged RPC grants

Supabase MCP applied the exact candidate
`202610101300_restrict_legacy_rpc_execution.sql`; the production migration
ledger records version `20261011013432` / `restrict_legacy_rpc_execution`.
Before the change, both `anon` and `authenticated` had direct EXECUTE grants on
`activate_worker_boost(uuid,text,integer,text)` and
`claim_worker_contact(text,uuid)`. Both are owned by `postgres` and run as
SECURITY DEFINER. The deployed commit `975196bb` calls boost activation through
the service-role client; it contains no call to the contact RPC. Registration,
public browsing and free contact do not call either RPC.

The migration only revokes the two client-role grants and retains/grants
`service_role` EXECUTE. Its transaction checks effective privileges and aborts
if a client can still execute or the service role cannot. Post-apply catalog
checks show `anon=false`, `authenticated=false`, `service_role=true` for both;
their ACLs now list only `postgres` and `service_role`. Supabase's matching
anonymous/authenticated SECURITY DEFINER advisories cleared. The migration
contains no worker/contact/payment row operations. Existing RLS flags remained
on for `workers` and `contact_requests`.

**Rollback SQL review:** before commit, `ROLLBACK;` would undo all grant changes.
After this successful commit, regranting EXECUTE to clients would recreate the
verified privilege vulnerability and is not an acceptable operational
rollback. The safe forward repair if service execution ever becomes unavailable
is `GRANT EXECUTE ON FUNCTION public.activate_worker_boost(uuid,text,integer,text),
public.claim_worker_contact(text,uuid) TO service_role;` followed by the same
effective-privilege assertions. No client grant should be restored.

## Applied: worker privacy repair — 2026-10-11

The owner waived a newly verified backup for the authorized narrow security
repairs. Supabase MCP applied `202610081600_worker_public_privacy.sql` in one
transaction with 2-second lock and 15-second statement timeouts. The migration
ledger records `20261011134526` / `worker_public_privacy`. It replaces broad
client grants on `workers` with an explicit public column projection, restricts
unapproved rows and direct worker writes, adds a bounded ownership check for
the contact SELECT policy, and denies direct client mutations of
`contact_requests`. It contains no row updates or deletes.

The earlier compatibility hold was reconsidered with new live evidence: there
were zero contact-request rows, and deployed `975196bb` calls
`getSupabaseClient()` without a user session. Its existing outcome UPDATE could
not meet either participant's `auth.uid()` RLS policy; the action ignored the
database error and redirected to success anyway. The SQL repair did not remove
a functioning outcome write path. **The misleading deployed success redirect
still requires a security-only application deployment.** The current local
action redirects to `status=pendiente` without a database write; it has not been
deployed. No synthetic production write was used to test this inference.

Before and after the migration, all 383 worker rows had the same aggregate
row digest (`5ee2ec609330ba98539fbbef7fa92e8f`); the contact table remained
empty. Post-apply effective privileges for `anon` and `authenticated` show no
SELECT on `edit_token`, `whatsapp_number`, or `user_id`, no worker or contact
UPDATE, and no EXECUTE on the two previously repaired privileged RPCs.
`service_role` retains those accesses. The restrictive approved-row and
write-denial policies are present. Live read-only PostgREST checks with the
public key returned 200 for public worker fields, 401 for edit token and phone
columns, and an empty result for unapproved workers. No worker/contact/payment
row was written, rotated, merged, or deleted.

The deployed registration and free-contact paths use the service role; public
browsing selects columns in the projection. These checks do not establish
successful registration/contact POST behavior. Supabase security advisor now
flags the intentionally callable, bounded `owns_worker_profile(uuid)` helper
for authenticated users; it returns only whether the caller owns the supplied
worker ID. The advisor also retains unrelated pre-existing notices.

**Forward repair:** if service access is lost, restore only its grants after
catalog review; never regrant private columns or direct writes to client roles.
Reverting this privacy migration would recreate the verified exposure and is
not an acceptable operational rollback. A failed transaction before commit
would have rolled back all policy and grant changes.

## Verification and next deployment step

On Node 24.21.0, `npm test` passed all 71 tests with the required subprocess
permission. A sandboxed run had blocked the braces test's child Node process
with `spawnSync ... EPERM`; its six cases and the full suite passed when that
permission was granted. The SQL candidate's timeout change passed its isolated
regression before application.

**Next application step:** obtain separate authorization for a security-only
production deployment of the prepared `app/resultados/actions.ts` fail-closed
outcome action. Verify the exact build against the current Vercel project and
keep all 2.0/payment/availability gates off. That deploy fixes the remaining
misleading success redirect; it does not constitute ListoRD 2.0 acceptance.
Review the additive 2.0 migrations and their duplicate-phone conflict plan,
production configuration and payment-capable hosting eligibility separately
before authorizing a full 2.0 deployment.
