# Worker privacy repair and consent-based activation

> **2026-10-09 checkpoint:** [current preparation and blockers](RELEASE_PREPARATION_2026-10-09.md).
> Production authentication is an external blocker; no credentials, production SQL,
> activation or deployment are requested. Latest local evidence supersedes older counts below.

Status: **candidate SQL, local PostgreSQL fixtures only; production unchanged**.
Baseline `4650db3`. The prior authorized live audit counted 378 approved workers,
4 anonymously visible unapproved rows and zero declared available workers. These
are historical counts, not a current contact list or 378 confirmed prospects.

## Evidence and repair

Repository migration `202604261330_fix_workers_public_select.sql` installed
`USING(true)`. `202604271100_add_worker_verification.sql` subsequently intended
`is_verified=true`. The live HEAD exposure establishes ineffective protection,
but without live catalogs we cannot say which policy/grant caused the drift.
RLS controls rows, not private columns: even approved-only RLS cannot protect
`edit_token`, `whatsapp_number`, or `user_id` under broad SELECT grants.

`202610081600_worker_public_privacy.sql` revokes table AND column privileges from
PUBLIC/anon/authenticated, grants the app's explicit public projection, and adds
restrictive approval/write guards. Existing permissive policies cannot override
these guards. Current registration, editing, admin, contact and availability use
the server service role; its existing grants remain intact. No profile, photo,
phone, token, payment or availability is changed. A narrowly scoped definer
boolean helper lets authenticated contact policies check their own worker
ownership without exposing owner IDs. It returns no profile data and has a pinned
search path. Review its owner and effective privileges in hosted staging.

This is NOT a blanket cleanup of all database objects. Inherited roles, views,
RPCs, storage access, unusual restrictive policies and live schema drift require
catalog review. Do not apply all historical migrations or schema.sql (contains
seeds). The privacy candidate deliberately fails on missing required columns.

## Staging / production acceptance gates

1. Obtain an authorized SQL connection and run `supabase/preflight_worker_privacy.sql`
   read-only. Inspect policies, grants (including PUBLIC/inherited roles), dependent
   views/materialized views, function owners/bodies/EXECUTE privileges and triggers.
   Keep bodies and credentials private. Review dynamic SQL manually. Reconcile
   actual columns with the candidate; do not guess deployed state.
2. Create an explicitly authorized hosted staging environment matching Supabase
   roles/auth/PostgREST/storage and deployed schema, using synthetic workers and
   redacted structure. No production worker export is required. Snapshot schema,
   grants/policies and production backups through authorized operator procedures.
3. Run the candidate privacy migration transaction, then the availability migration
   if absent. Isolated PGlite tests cover both together; they are **not** hosted
   staging verification. Test anonymous AND authenticated REST select/filter/order/
   embed/count attempts on private fields, unapproved profiles, views and RPCs.
   Expect permission denial on private columns and zero unapproved public rows.
4. Verify homepage/profile/matching projections, zero matches, images, registration,
   owner editing, admin moderation, free contact, availability issuance/renew/pause,
   expiration/reissue and legacy Stripe webhook reconciliation through actual APIs.
   Review `contact_requests` legacy outcome triggers: the repository's invoker
   `refresh_hiring_stats` updates workers, which client roles cannot do after this
   repair. The outcome action is now disabled and the candidate denies direct client
   contact mutations. It never reports success. Resolve verified ownership + scoped
   server outcome mutation before accepting that flow. Do not elevate a broadly callable
   stats function just to bypass the restriction. This is a rollout blocker.
5. Confirm admin credentials/session cookies and server action/API authorization in
   staging; missing/wrong admin secret must deny access. Verify no service credential
   reaches browser bundles. Confirm gate=false yields no issuance or renewal.
6. Assess exposed legacy UUID edit tokens and historical URL/analytics logs. Existing
   edit and boost routes still trust these capabilities: hiding the column does
   **not** revoke previously copied tokens. Prepare approved containment/rotation,
   ownership recovery, log-retention response and late payment reconciliation.
   Do not distribute new links on the strength of a legacy token or a typed phone.
7. Record staging results and explicit production migration/deployment approvals.
   Until then keep renewal disabled and Express checkout disabled. After an approved
   change, repeat read-only aggregate/privacy checks without fetching private data.

Rollback: a failed SQL transaction rolls back atomically. After a committed repair,
keep private columns restricted; do not restore the leaking grant/policy as an
operational rollback. Disable renewal and stop link issuance if regression occurs;
fix projections/server consumers forward using reviewed SQL. Preserve all rows and
photos. Roll back app code only to a version compatible with the safe projection.

## Activation pilot (prepared, no messages sent)

- Start only after the privacy, legacy-token incident, admin and staging gates above
  pass, and the owner explicitly approves any outbound messages. Approval to prepare
  this runbook is not permission to contact 378 workers.
- Prefer inbound requests from existing workers. An authorized operator verifies
  control through an independently established channel/account; a public phone
  string, matching name, screenshot or exposed edit link is not sufficient proof.
  Escalate ambiguous ownership to recovery; never create a duplicate profile.
- Record worker ID, operator, verification method/time, channel, explicit request
  to receive a private availability link and consent evidence in restricted operations
  records. Do not put capability URLs or unnecessary identity documents in notes.
  Admin issuance now requires separate ownership and link-consent attestations.
  The current shared admin session is not an individual audit identity; named operator
  evidence remains a production operations prerequisite.
- Issue one private link to the verified, consenting worker via an approved private
  channel. Delivery is manual; the app sends nothing. Reissue invalidates the old
  availability link and resets private confirmation; it never asserts availability.
- Worker opens it and explicitly selects available or paused. Only this action
  records availability; doing nothing leaves the worker outside confirmed matching.
  No registration or new profile is required. Confirmation expires after 30 days;
  private access expires after 180 days. A work request still needs its own YES/NO.
- Link delivery consent and availability are NOT Express messaging consent. No
  campaigns/reminders/Express invitations without separate channel-specific consent
  and provider compliance. Honor refusal/opt-out; never auto-renew.
- Pilot a small owner-approved cohort, checking only aggregate issuance, explicit
  confirmations, pauses, expiry and eligible matches. Scale only after privacy and
  recovery work correctly. Never label all approved profiles “available”.

Next milestone: authorized catalog review + hosted staging acceptance and approved
legacy-token containment/recovery, then explicit approval for production repair and
an opt-in activation pilot. Employer opportunity/payment work stays out of scope.
