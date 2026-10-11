# Unapplied 2.0 schema package and production impact — 2026-10-10 EDT

**2026-10-11 update:** This is the pre-application impact review. The reviewed
additive migrations below have since been applied in dependency order. The
normalized-phone unique index was split out, then retired to preserve legitimate
shared numbers.
See the [current production handoff](PRODUCTION_RELEASE_HANDOFF_2026-10-11.md)
for migration ledger versions, data checks and the next release step.

The existing production catalog has legacy tables only. The migration ledger
now contains `restrict_legacy_rpc_execution` and `worker_public_privacy`; no
`marketplace_*`, `worker_availability`, or owner identity schema has been
applied. The remaining 2.0 package is **unapplied**.

Apply remaining candidates only in reviewed dependency order after their
catalog, data and deployment dependencies are resolved:

1. `202610071200_marketplace_foundation.sql` creates four new opportunity,
   owner, interest and report tables, indexes, triggers and RLS. It does not
   publish legacy leads or rewrite existing worker/payment rows.
2. `202610081400_worker_availability.sql` creates a private availability table
   and service-only issue/renew functions. The migration does not backfill or
   activate workers. Later calls to renewal can update `workers.available_now`.
3. `202610081600_worker_public_privacy.sql` **applied on 2026-10-11**. It
   closes existing client access to private worker columns before any new
   owner identity is added. The deployed legacy outcome action still displays
   a misleading success redirect; the safe local action needs a separate
   security-only application deployment.
4. **New candidate:** `202610081700_worker_owner_identity.sql` adds a nullable
   `workers.owner_user_id` foreign key to `auth.users`. No existing worker is
   assigned an owner. It aborts unless the privacy guard exists and effective
   client grants cannot read the existing edit token or the new owner column.
   This column is required by lifecycle and Express SQL; the previous local
   fixtures had assumed it existed, but production does not have it.
5. `202610091200_marketplace_lifecycle.sql` adds private rate, consent, event
   and ownership-audit tables and server-only RPCs. Its owner-link RPC is the
   only intended way to set the new column after independent ownership review;
   no historical owner is inferred from phone or edit token.
6. `202610091300_express_fulfillment.sql` adds separate one-time payment and
   invitation ledgers, a response trigger and server-only fulfillment RPCs.
   Existing Stripe rows remain separate. It requires lifecycle, availability,
   owner identity and verified consent.
7. `202610101200_ingestion_budget.sql` creates a private budget table/RPC and
   a normalized-phone unique index on existing workers. Read-only production
   aggregate preflight found **19 duplicate normalized-phone groups covering
   40 rows**. The index will fail as written; no rows should be merged or
   deleted by this migration. Review a non-destructive conflict strategy first.

The package introduces RLS and explicit client-denial grants for private new
tables; the foundation exposes only moderated, live opportunity rows. Verify
function EXECUTE privileges, ownership, RLS, PostgREST behavior, migration
ordering, lock impact and Supabase Auth references before any production SQL.
The nullable owner-column candidate has an isolated PostgreSQL regression
covering legacy-row preservation, public-grant preflight and private ownership.
Local synthetic tests do not verify hosted provider behavior. Keep marketplace,
Express, availability renewal and legacy payment gates off until their release
conditions and commercial hosting rules are satisfied.
