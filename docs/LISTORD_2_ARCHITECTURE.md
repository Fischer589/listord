# ListoRD 2.0 — audit and staged architecture

Audit date: 2026-10-07. Starting checkpoint: `d3ca14f`.
This document distinguishes repository evidence from production facts. No
production database, payment account, migration, storage object or deployment
has been modified. A successful local build is not production acceptance.

## Current architecture and evidence

Next.js 14.2.3 App Router / React 18 / TypeScript / Tailwind; Supabase Postgres
and public Storage; Stripe Checkout and signed webhook. Vercel's project API
reports `nextjs` and Node `24.x`; this workspace runs Node 20.19.2. The preceding
image audit confirmed deployed SHA `1a54b1f` against this checkout's parent.
The image safeguard at `d3ca14f` is local, not deployed. No live database schema
or storage inventory has been read: credentials are absent locally.

Public pages use the anonymous Supabase client; registration, editing, admin,
contact and billing use a service-role client. `user_id` references exist, but
the UI does not establish a Supabase Auth session. Worker ownership currently
uses long-lived edit tokens; employer browser IDs and phone numbers are not
verified identity. Do not infer real account ownership from either.

The route inventory includes home; 14 category and 112 category/city landings;
worker detail, registration, editing and recovery; employer marketing/account,
private lead submission and deposit; contact/outcome pages; admin worker/lead/
payment/analytics screens; analytics, contact, premium and seven Stripe APIs.
`main.py` is empty. No alternate backend is needed.

## Component decisions

| Area / evidence | Decision | Required change or preservation |
| --- | --- | --- |
| App Router, Vercel, TypeScript, Tailwind | KEEP / INVESTIGATE | Preserve deployment architecture; assess supported Next security upgrade separately. 14.2.3 is old and installation warns of vulnerabilities. Test Node 24 parity before release. |
| Supabase clients, workers/employers IDs, contact/payment records | KEEP | No reset, reseeding or replacement database. Keep existing valid records and references. |
| `schema.sql`, chronological migrations | INVESTIGATE / MIGRATE | Schema includes seed data and is not a production migration runner. History has non-idempotent scripts and drift (featured/pro deliberately omitted in worker query). Compare actual schema/policies before applying new SQL. |
| Public worker SELECT policy | MIGRATE urgently | Row-level visibility does not hide `edit_token` or phone columns. Check live grants; introduce explicit public projection/column grants, remove private fields from public queries, then revoke broad access. Never apply a blanket revoke before consumers are migrated. |
| Admin middleware and service-role actions | REFACTOR urgently | Default auth bypass; privileged actions lack independent checks. Fail closed and verify session inside each privileged read/write. Preserve configured login credentials. |
| Registration and edit recovery | REFACTOR urgently | Duplicate registration returns edit token from phone alone; edit page also recovers it from a query phone. Remove these disclosure paths; keep valid existing edit links and support recovery pending verified identity migration. |
| Worker forms | REFACTOR | Minimal registration exists; editing requires excessive enrichment. Validate server inputs, show photo failures, preserve entered values, allow optional enrichment. |
| Photos / `images.unoptimized` | KEEP / REFACTOR | Keep all existing URLs and safeguard. Decode, orient, bound dimensions, strip metadata, encode WebP before new upload. Immutable opaque paths and long source caching. No remote-fetch migration endpoint. |
| Category/city catalog and search | KEEP / REFACTOR | 14 categories, 8 city landing entries; preserve slugs/SEO links. Text city field allows more locations. Synonym matching exists but needs canonical alignment and unit-aware compensation matching. |
| `lib/workers.ts`, discovery carousel/cards | REFACTOR | Current query loads all approved workers, exposes phone in client props, sorts active boosts before suitability and filters in memory. Bound queries; category/location first; explain ranking; do not label all records available now. |
| `employer_requests` and admin lead workflow | KEEP / MIGRATE | Private contact-bearing leads are not publishable opportunities. Preserve originals; explicit consent and completeness review before any backfill. |
| Worker opportunity discovery | BUILD | No public opportunity entity, publication consent, interest record or lifecycle currently exists. |
| Contact API and two duplicated contact/paywall UIs | REFACTOR | One free contact/day, race-prone count/insert, caller-controlled session and phone. Replace with structured request validation and a shared qualification flow; anonymous exploration stays open. |
| `/contacto/[workerId]` | REMOVE or redirect after replacement | Form has no submission handler and describes an obsolete pending-contact model. Trace links before retirement. |
| `resultados` + outcome triggers | KEEP / REFACTOR | Separate interest/contact/hire outcomes. Current anonymous client has no identity for owner RLS and ignores update errors. Require verified participants; never count a WhatsApp open as a hire. |
| Stripe employer premium/deposits | KEEP / INVESTIGATE | Preserve signed webhook and financial records. Premium webhook only handles checkout completion; renewal/cancellation/delayed payment semantics need review. Client phone alone must not grant access. No new prices or charges. |
| Worker boost/featured/pro | MIGRATE / REMOVE from discovery | Trace checkout → history → webhook/RPC → ranking/UI/admin analytics. Stop new paid ranking sales together with ranking removal, preserve historical payments and late webhook reconciliation. Existing entitlements/refunds require an explicit operational policy before deployment. |
| Admin moderation | REFACTOR | Protect all reads/actions; rejection currently deletes pending workers. Prefer reversible moderation state. Do not delete records as part of this rebuild. |
| Analytics | KEEP / REFACTOR | Private table, public event ingestion with weak payload bounds and no durable spam control. Add bounded event allowlist and timings; never include phone/address/edit tokens. Admin access must fail closed. |
| UI, responsive CSS, brand, logos | KEEP / REFACTOR | Keep green/cream identity and editorial typography; simplify dense header and long cards. Existing CSS has mobile breakpoints but no reduced-motion rule. Add keyboard focus, accessible dialogs, field errors and mobile browser verification. |
| SEO and trust copy | REFACTOR | Preserve valid category URLs/metadata. No sitemap/robots route. Do not claim identity checks, current availability or ratings without evidence. Remove unsupported “3× más clientes” photo claim. |
| Error/loading boundaries | KEEP / REFACTOR | Existing fallback pages are useful. Distinguish zero results from unavailable data, avoid raw database errors, validate arbitrary JSON types before `.trim()`. |
| Tests/tooling | KEEP / EXTEND | Six image renderer tests only, no lint setup. Add focused security, image and database tests; real build/typecheck at checkpoints. No claim of live payment or data-flow verification without credentials. |

## Target architecture

Keep one Next app and the existing Supabase project. Share a versioned request
schema between form rendering, server validation, decision cards and Spanish
WhatsApp serialization. Do not trust client-computed completeness or ranking.

`service + general location → category questions → reviewed specification →
worker/opportunity results → interest or decline → contextual contact`.

Use a new `marketplace_opportunities` public-safe entity. Store contact details
and ownership in a separate private table; no residential address is required
for discovery. Publication is explicit and moderated. Lifecycle is
draft → open → filled/closed, with expiry checked on reads as well as jobs.
Interest is unique per opportunity/worker and never means accepted/hired.
Anonymous users browse; writes use verified ownership or existing protected
capabilities until accounts can be linked safely. Never link an account merely
because someone entered an existing phone number.

Store category schema version, answers, scope/inclusions/exclusions, location,
schedule, duration and compensation type/unit/currency. Unknown values remain
unknown; a budget is not a promised wage. Schema changes preserve older answers.
Public projection is allowlisted, not `select *`. Financial tables stay private.
Ranking excludes payment fields and surfaces reasons/unknowns, with stable ties.
Availability needs its own confirmation timestamp: ordinary `updated_at` also
changes for moderation and boosts and is not proof of current availability.

## Category schema coverage plan

Shared: general city/zone, date or explicitly flexible schedule, duration,
compensation amount/range and unit or labeled budget, exclusions, requirements.
Never ask for an exact residential address or private medical history publicly.

| Existing searchKey | Only the additional decision questions |
| --- | --- |
| limpieza | Property, rooms/scale, tasks, supplies, explicit cooking/laundry exclusions |
| cocina | Home/event/business, diners, meals/menu, ingredients/equipment, dietary requirements |
| plomeria | Issue, fixture, urgency, materials, optional private diagnostic photo |
| electricidad | Fault/installation, affected fixtures, urgency, materials, required qualifications |
| construccion | Trade, task, stage, tools, crew size, duration |
| pintura | Interior/exterior, approximate area, surface condition, paint/equipment |
| clases | Subject, level, learner count, remote/in-person, frequency |
| belleza | Service, client count, at-home/salon/event, supplies, special requirements |
| jardineria | Tasks, approximate area, tools, green-waste removal |
| conductor | Pickup/destination zones, passengers/cargo, vehicle/provider, distance if known |
| ninos | Child count and age bands, tasks, schedule, relevant qualifications (no child names) |
| cuidadora | Non-private assistance tasks, mobility support, schedule, required qualifications |
| carpinteria | Build/repair/install, item, approximate dimensions, materials/tools |
| seguridad | Site/event, shift, scope, legitimate qualifications, equipment |

Bartending is not in the current taxonomy. Add a reviewed canonical category
and synonyms before exposing a bartender schema; do not silently classify it as
cooking. Delivery can start within conductor with a cargo/vehicle branch.

## Migration and implementation sequence

0. Audit/checkpoint: baseline tests/typecheck/build; classify routes, risks and
   dependencies. No production writes.
1. Foundation, independently deployable subphases:
   - 1A: fail-closed admin guards and close phone-only edit-link disclosure;
     normalized photo upload with explicit failures, old references preserved.
   - 1B: additive opportunity/private-contact/interest/report tables, constraints,
     indexes and deny-by-default access; execute migrations against isolated
     Postgres fixtures and prove existing rows remain. No production application.
   - 1C release gate: inspect live grants/schema, backup, storage configuration,
     admin credentials and ownership recovery; verify staged production-like
     upload and RLS, then request explicit migration approval. Do not claim this
     step complete from mocks.
2. Service/location front door and schema engine with all catalog categories;
   shared validation, accessible progressive form and reviewed draft card.
3. Suitable worker results and structured contact; omit private fields, explain
   match reasons, preserve available legacy links, remove core contact paywall.
4. Published opportunity browse/detail, verified interest/decline, owner lifecycle,
   moderation/reporting. No fabricated opportunities to fill empty screens.
5. Freshness-aware matching, stale/expired handling, retirement of paid ranking
   checkout/UI with financial history and webhook reconciliation intact.
6. Mobile/keyboard/browser tests, zero-result/error journeys, SEO, performance,
   private funnel metrics and visual refinement across both sides.

Every subphase runs relevant tests, typecheck, lint when configured, production
build, diff review and a local checkpoint. Tests must cover rejection paths,
authorization, privacy and missing configuration, not only happy-path rendering.

## Release gates and rollback

Do not run `schema.sql` on production: it creates baseline objects and seeds.
Inventory live migration versions and grants first. Back up before any approved
migration; use additive changes and expand/migrate/contract ordering. No automatic
lead backfill, token rotation, old-photo deletion or payment cancellation.
Photo backfill must allowlist the existing storage bucket/object paths, avoid
arbitrary URL fetching, write a resumable manifest, retain originals, and update
references only after verified output. It requires explicit production approval.

Local rollback is a code revert. Additive tables can remain unused; never drop
them as an automatic rollback. Disabling new photo processing must not re-enable
Vercel optimization. Admin fail-closed changes require configured credentials
before release; do not restore auth bypass to work around missing credentials.

Production-critical open questions: actual worker column grants and leaked-token
exposure; account/phone ownership verification method and recovery operations;
which historical paid entitlements remain active; deployed Node/Next security
compatibility. These require scoped read-only production evidence or owner
decisions, not invented assumptions.

## Phase 2A implementation and Express release boundary (2026-10-08)

`/solicitar` is an anonymous, client-side request draft. The homepage employer CTA
opens it. `lib/request-specification.ts` owns version 1 schemas for the exact 14
existing category search keys, progressive validation and the Spanish summary.
The four screens collect service/city, category scope, common terms, and preview.
Existing city suggestions are reused; other Dominican municipalities remain valid.
Timing/duration may explicitly be flexible or pending an estimate. Compensation
is fixed, a labeled budget, or explicitly negotiable; all amounts are DOP.
Editing preserves common terms; changing category clears incompatible answers.

The draft remains in React state while this page is mounted. It is neither
published nor saved to a database/browser storage, and no worker receives it.
Copying the summary is explicit. The discovery link reuses service/city filters;
it does not imply request-level compatibility, fresh availability or interest.
No exact address field is collected; guidance warns against private data in free
text. Future publication must validate/moderate free text server-side: this
local preview is not a privacy sanitizer or authorization boundary.

### Express: required release architecture, not activated in Phase 2A

ListoRD Express is **RD$299 per request, one-time, no subscription**. Workers
participate free. Basic discovery and direct contact must remain free; migrate
the existing contact paywall and pay-to-rank sales safely, retaining historical
financial records and valid entitlements. Do not add tiers or activate charges
from this checkpoint.

Ordered prerequisites and boundaries:

1. Persist the versioned request under verified employer ownership, privately by
   default. Add a public-safe specification adapter and repeat validation on the
   server before persistence. Do not publish legacy employer leads automatically.
2. Query actual eligible workers using supported category/location, availability,
   scope and requirement evidence. Exclude inactive/unavailable/ineligible records;
   unknown compatibility is not confirmation. Show the actual eligible count
   before Express. Existing discovery results are not an Express outreach count.
3. Gate Express checkout on real deliverability: consented reachable recipients,
   functioning outbound provider, fulfillment capacity and disclosed terms. If
   these are missing or count is zero, do not accept payment. Define the response
   window and no-response remedy before charging; never guarantee a hire.
4. Card: extend existing Stripe hosted Checkout infrastructure with a separate
   Express purpose, RD$299 one-time price and server-owned request reference.
   Verify DOP presentment and U.S. account settlement configuration in Stripe's
   current documentation and the actual account/sandbox before implementation.
   Disclose any conversion before payment; Dominican-issued cards remain subject
   to issuer/processor acceptance. Account eligibility is NOT verified here.
   Fulfillment requires signed server-verified paid webhooks, amount/currency/
   reference checks and durable event/payment idempotency; never trust redirects.
5. Transfer: issue a unique Express reference and open the verified business
   WhatsApp with a payment inquiry. No unverified bank instructions. Remain
   PAYMENT_PENDING until a server-authorized admin confirms actual receipt with
   an audit trail. Screenshots, messages and receipt uploads are never proof.
6. Both payment paths enter the same idempotent fulfillment/outbox boundary.
   Separate request, payment, outreach and response states; unique payment/event,
   request-worker invitation and response constraints. Retry partial failures
   without recharging or duplicate outreach. Recheck eligibility before dispatch.
7. A real supported notification provider must send authorized invitations and
   record provider IDs/results. Workers submit authenticated or securely scoped
   ME INTERESA / NO ME INTERESA responses; consent and opt-out must be respected.
   Employer updates and shortlist contain actual interest, followed by contextual
   WhatsApp. A WhatsApp handoff is not an acceptance or hire.
8. Minimal existing admin extension: requests, payments, transfer confirmation,
   delivery attempts/failures, responses, refunds and revenue; enforce server-side
   authorization and audited idempotent mutations. No oversized new dashboard.

No payment routes, Express tables, live charges, outreach or banking instructions
were added in Phase 2A. Notification provider/consent coverage, secure ownership,
Stripe currency/account/sandbox verification, verified transfer contact and
fulfillment/no-response terms remain release blockers. Build these in independently
verified later slices; all production SQL and deployment still require approval.

## Phase 2B — server-validated worker matching

The anonymous preview now calls `POST /api/requests/matches` explicitly. A bounded
12 KB JSON reader and runtime parser reject malformed, unknown, overlong or
incomplete fields before any database call. Server code reads existing worker
records via the anonymous Supabase client and an explicit allowlist; no new table,
column, SQL execution or data rewrite is required. Responses are private/no-store.

### Supported evidence and conservative eligibility policy

Repository schema has `is_verified`, `available_now`, `created_at`, city, skills
and requested income/unit. It has **no dedicated active/inactive status, last-seen
signal, availability confirmation timestamp, structured task qualifications or
schedule calendar**. Registration/editing do not currently maintain an explicit
`available_now` renewal flow. `updated_at` changes for boosts/moderation and must
not be used to revive eligibility. The live schema still needs read-only preflight.

Phase 2B therefore counts only explicitly approved, explicitly available profiles
**created within the last 30 days**, excluding missing/future timestamps and
incomplete identity/location/skills. This is a conservative age bound on the
availability flag, NOT confirmation that the worker is active, reachable or free
for the requested date. The 30-day window is a local product safety policy, not an
observed worker behavior or previously collected consent. Older valid workers are
preserved and remain discoverable; edits/boosts do not reset this window. Many or
all legacy records may legitimately yield no eligible matches. A verified worker
availability/activity renewal flow is the next release-critical prerequisite.

Location uses normalized exact city equality (accents/case/spacing), avoiding
substring conflation of neighboring municipalities. Category matching uses explicit
trade labels/aliases in skills, not broad words in biographies. Ambiguous child/
adult care aliases are excluded. Existing category taxonomy is unchanged.
Same-unit known income above the request's amount excludes a worker; incomparable
or missing income is not silently converted. Exact skill phrases present in the
scope are shown as supporting evidence and sort first, with stable ID ties.
Unknown schedule, qualifications, requirements and remaining scope are explicitly
unconfirmed; the count is **compatibility on supported signals**, not a promise
that all requirements are met or any worker is interested. Paid ranking is absent
from this new matching path; legacy ranking migration remains separate.

The query requests an exact candidate count and at most 1,000 recent approved,
available rows. If response length/count disagree, IDs duplicate, data is missing,
or the cap is exceeded, return 503 with no count. Never advertise a partial total.
This bound prevents unbounded reads; a larger pool will need DB-side normalized
filtering/pagination or a snapshot RPC, verified against live policy/schema first.
Counts describe one query snapshot and may change; contact rechecks eligibility.
No raw DB errors, private worker fields or excluded-worker counts reach the client.

### Free contact and disabled Express

Matching results display actual counts, explain the exclusions, and distinguish
zero from database/configuration failure. Editing unmounts results and aborts
pending requests so an old result is not reused for a new draft. Browser rendering
shows 20 records at a time; count includes the complete eligible result set.

`POST /api/requests/contact` validates the structured draft and worker UUID, then
rereads that one worker and rechecks the same criteria. The phone is selected only
for this explicit handoff and never included in match lists. It returns a contextual
WhatsApp URL without checkout, payment lookup, session writes, invitation or hire
record. The URL necessarily reveals the destination phone to the contacting user,
as the existing WhatsApp workflow does. This endpoint is anonymous for approved
public profiles, not an account-ownership proof. Durable anti-scraping/contact
rate controls remain P0. Exact addresses are neither required nor fetched.

The existing directory/contact API, paid entitlements and financial history are
unchanged; legacy one-free-contact/day behavior still exists outside the new
request-matching path and must be removed safely before release. The new results
provide free contact independently of Express.

The Express card uses the computed count, explains future outreach/organized
interest and shows RD$299 one-time. Its native button is permanently disabled in
this checkpoint; no checkout URL or bank instructions exist. Zero/error states
never initiate outreach or payment. Actual provider consent/reachability, verified
payment confirmation, fulfillment terms/remedy, shortlist and response collection
are still future release work, not fulfilled promises in this checkpoint.

## Phase 2C — verified live reads and private availability renewal

See `LIVE_AVAILABILITY_AUDIT.md` for timestamped evidence. The real Phase 2B query
is compatible and returns zero candidates; 378 approved rows exist, none declaring
availability. Effective anonymous reads also expose unapproved rows and sensitive
worker columns. No private values were retrieved. Full SQL policy/grant definitions
remain inaccessible through the available public-key REST path.

### Authorization decision

Legacy `edit_token` values are potentially publicly readable, so they MUST NOT
bootstrap new availability authority. No phone-only claim or automatic token reuse.
Instead, after actual owner verification, an authenticated admin can issue a new
256-bit private availability link in the existing worker admin page. The server
requires both admin authorization and explicit verification attestation. The link
controls availability only, not profile identity or payment. Issuing a link sends
no message; secure delivery to the verified owner remains an operator task.

The additive, UNAPPLIED `202610081400_worker_availability.sql` creates a private
worker-ID-keyed table. It stores only SHA-256 of the random capability, a 180-day
access expiry, ownership-verification/issuance timestamps, availability and its
confirmation time. Anonymous/authenticated roles cannot read/write it or execute
the RPCs; only server service-role access is granted. No legacy worker, photo,
payment or token is backfilled, deleted or rotated. Reissuing this new link revokes
its predecessor without modifying legacy profile links; worker confirmation is
still required. A caller's boolean verification assertion has meaning only after
the server has authenticated the admin; it is not automated identity verification.

Worker `/trabajadores/disponibilidad#clave=...` consumes the private URL fragment
and clears it from browser history. Fragments are not sent in page requests. No
registration, second profile or full profile edit is required. Two actions: confirm
availability or pause. The JSON POST sends the private capability only to the
availability endpoint; it is hashed server-side and never echoed. The database
locks the worker, rechecks approval/current capability/expiry, and atomically
records server time and updates the existing `available_now` flag. A client cannot
supply a worker ID or renewal timestamp. Invalid, expired and unapproved access
produce generic denial. Pausing immediately removes confirmed-mode eligibility.
Workers must retain their original private link; page refresh without the fragment
requires reopening it. Lost/expired access goes through existing secure recovery.

### Freshness and rollout gate

`WORKER_AVAILABILITY_RENEWAL_ENABLED` defaults false. Both issuance and renewal
fail closed and the existing Phase 2B creation-age/30-day matching guard remains
intact. No production environment was changed. Enabling is expressly blocked on
live privacy repair, admin configuration, approved migration and staging acceptance.
The private table alone does NOT repair existing workers' RLS/grant exposure.

With the gate enabled, matching uses a service-role read of the private availability
record joined to an approved public-safe worker projection. Both available flags
must be true, capability access unexpired, and the database-stamped confirmation
strictly newer than now minus 30 days and not in the future. Old worker profiles
can qualify after an explicit fresh confirmation; creation dates/boosts/profile
edits cannot renew them. Missing migration/data/configuration produces an error,
never a fallback to a stale or partial match count. Contact rechecks the same
private state before returning the free contextual WhatsApp handoff. Schedule and
interest remain unconfirmed; Express remains RD$299 with checkout disabled.

For capability hygiene, worker routes send no-referrer headers and page-view
analytics no longer include URL query strings anywhere. This prevents new tracking
of old edit tokens, phones and payment references; it does not erase historical
logs, repair column grants or revoke exposed legacy tokens. Those actions require
an approved incident/compatibility plan. Runtime/dependency and abuse-control P0s
remain; local verification is not authorization for production activation.

### Privacy/activation preparation after Phase 2C

The unapplied `202610081600_worker_public_privacy.sql` candidate retains the direct
anonymous worker-read architecture through explicit public column grants plus
restrictive approved-only RLS. Private fields and client writes are denied, including
pre-existing column grants; inherited privilege/bypass findings abort the transaction.
Server-role registration, moderation, contact and availability remain separate.
A pinned-search-path, self-only boolean ownership function supports existing contact
read policies without granting owner-ID reads. Legacy outcome statistics triggers
must be reconciled in hosted staging before rollout; they are not promoted to
security definer. Public views/RPCs and actual deployed privileges require catalog
review. No live schema or token change is implied by this local migration file.

Private availability issuance now requires distinct owner-verification and
link-consent attestations. It sends nothing and never activates a worker. The
30-day worker-confirmation rule and default-off renewal gate remain unchanged.
See `WORKER_PRIVACY_ACTIVATION.md` for hosted acceptance, incident/recovery gates
and the consent-based pilot. RD$299 Express remains disabled and out of scope.
