# Worker activation campaign — prepared, sending closed

This change prepares a private queue for every worker row. It does not infer
ownership, availability, invitation permission, WhatsApp job notification
consent, delivery, or payment from registration. It makes no outbound request.

## Data and access

- Apply only `202610201200_worker_activation_campaign.sql` through the reviewed
  production migration mechanism after reconciling the live schema and recording
  a backup. Do not replay historical migrations or seeds. The migration inserts
  one private queue row per existing worker and a trigger covers later inserts;
  it does not update workers. It changes the four existing Express SQL freshness
  checks from 30 to 7 days and fails closed if their definitions differ.
- `/admin/activation` requires an admin session and reads all workers with exact
  counts. It refuses a truncated audit. The response contains worker IDs, channel
  availability flags and status, never numbers, tokens or evidence references.
  Only the service role can read campaign tables.
- A telephone field is merely a candidate WhatsApp channel. It does not
  prove reachability or permission. Shared numbers, invalid numbers, pending
  profiles, suppressions, opt-outs and prior batch recipients cannot enter the
  routine draft. Admins record a restricted case reference only after reviewing
  explicit permission for the *activation invitation* on WhatsApp.
  Registration and Express job notification consent are not this permission.
- The first draft and database are limited to ten workers per batch, atomically
  deduplicate worker IDs and normalized phone
  fingerprints, and enforces a cost ceiling. A draft has no sender. Suppression
  and self-service opt-out cancel unsent draft recipients. Provider failures can
  be recorded as suppressed/unreachable without automatically retrying.

## Worker response

- A worker whose ownership was already independently linked to a verified Auth
  account can use `/trabajadores/activar` without an admin-issued link. Only a
  fresh server-verified Auth token can confirm that account's approved profile.
  Each explicit yes/no availability decision is recorded in the private ledger;
  a new confirmation lasts seven days and can be renewed. It rotates any old
  availability bearer token.
- Future WhatsApp job notices have their own revocable `jobs-v1` consent.
  Availability never writes this consent. The activation
  invitation has separate permission and opt-out fields.
- Each invitation renders an HTTPS URL with the worker ID as a selection hint.
  The URL carries no bearer authority: fresh verified Auth and linked ownership
  are checked before any profile action. Unlinked claimants need independent
  ownership review. Keep invitation URLs out of public logs.
- Unlinked legacy profiles need independent ownership proof. An old edit token,
  phone possession, public profile facts or a newly verified email alone cannot
  auto-link one. Shared or disputed cases remain in manual review. An approved
  identity verification method is required before routine automatic linking of
  those profiles can be enabled.

## First controlled batch and launch gates

1. Obtain authorized read-only production audit access and compare exact queue
   count with worker count. Review channel, ownership, invitation permission,
   consent, suppression, availability and prior delivery counts. This workspace
   cannot currently perform that live audit because Netlify masks the service
   credential and the named auditor connection has no password. Run
   `supabase/audit_worker_activation_read_only.sql` through that connection,
   reconcile the migration with its catalog output, then after an approved
   migration run `supabase/audit_worker_activation_queue_read_only.sql`.
   Do not substitute public listing counts.
2. Confirm an approved WhatsApp Business Platform provider, approved Spanish
   template, recipient and channel policy, unit cost and total batch ceiling,
   signed delivery/opt-out webhooks, rate limits, quiet hours, and the operator
   accountable for manual exceptions. Meta Cloud API is the simplest direct
   candidate; WhatsApp Business Express is excluded. Submit the invitation as a
   marketing template for Meta review, with the worker-specific URL variable.
   Meta charges by delivered message and recipient market/category. A published
   2026 rate card lists US$0.074 per delivered marketing message for Rest of
   Latin America (indicative US$0.74 for ten deliveries), but the current Meta
   account rate and any provider fees must be confirmed before approval. No
   provider or cost has been approved here.
3. Independently verify and record invitation permission per worker. Mark invalid,
   disputed or opted-out contacts as suppressed. Resolve shared numbers manually.
   Review the first ten eligible records and save only a draft batch.
4. Before sending, add and test a provider-specific one-shot dispatcher with an
   atomic claim, recheck of live permission and suppression, receipt reconciliation,
   delivery failure handling and inbound opt-out processing. An uncertain send
   must never be retried automatically. No sender or send endpoint is included in
   this preparation.
5. Obtain explicit approval for that exact batch, channel, cost and template.
   Only then send the small pilot. Measure sent, delivered, responses, verified
   owners, seven-day available workers, unavailable and unreachable workers;
   inspect delivery failures and stop before expanding the next batch.

The signed-in activation path can support already linked workers immediately
after the reviewed migration and deployment. The unlinked legacy base and outbound
campaign remain gated on independent identity and communication controls. Paid
employer contact still requires the existing verified account, paid order and
fresh worker eligibility checks.

Pricing and policy references: Meta's [Business Platform pricing](https://whatsappbusiness.com/products/platform-pricing/)
and [messaging policy](https://business.whatsapp.com/policy/preview?lang=es_LA);
the [January 2026 USD rate card hosted by Gupshup](https://www.gupshup.ai/resources/wp-content/uploads/2025/12/USD_Jan2026.pdf)
provides the indicative Rest of Latin America marketing rate. Reconfirm the
current account rate and classification in Meta before setting a cost ceiling.
