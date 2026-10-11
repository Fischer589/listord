# ListoRD 2.0 production deployment handoff — 2026-10-10

**Decision: BLOCKED for the full 2.0 launch.** This is a production-only
handoff for the existing Vercel `listord` project in
`darnellfischer1-3955s-projects` and `listordapp.com`. The earlier staging
search is closed for this release decision. There is no additional monthly
infrastructure proposal. No production SQL, data write, push or deployment was
performed. Prior checkpoints and the uncommitted hosted-acceptance report were
preserved.

## Actual production blockers

1. **Live privacy and privileged RPC exposure.** Read-only production catalog
   queries confirm `anon` and `authenticated` can SELECT `workers.edit_token`,
   `workers.whatsapp_number` and `workers.user_id`. The advisor and effective
   privilege check confirm both roles can EXECUTE the `SECURITY DEFINER`
   `activate_worker_boost` and `claim_worker_contact` RPCs. The boost RPC writes
   a paid boost from caller parameters without an internal Stripe verification.
   The prepared privacy candidate
   (`202610081600_worker_public_privacy.sql`) and the new privilege-only
   candidate (`202610101300_restrict_legacy_rpc_execution.sql`) are **unapplied**.
   Exposure review and legacy edit-token recovery remain required. The new
   candidate preserves service-role calls and existing rows; a synthetic
   PostgreSQL regression verifies effective denial and service access.
2. **2.0 schema absent.** Production `list_tables` shows the legacy tables and
   no `marketplace_*` or `worker_availability` table. Supabase reports an empty
   migration ledger. The dependency-ordered foundation, availability, privacy,
   lifecycle, Express and ingestion-budget candidates are prepared in
   `supabase/migrations/`, but none can be assumed applied. The historical
   `supabase/schema.sql` embeds seed rows and must never be replayed onto
   production. Reconcile the actual catalog, grants, triggers, duplicate phones,
   backup and forward-repair plan before selecting any production SQL.
3. **Production configuration is incomplete for full 2.0.** The authenticated
   Vercel CLI confirms the correct existing project, Next.js and Node 24. Its
   production variable inventory includes legacy Supabase and Stripe variable
   names, but lacks `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
   `ADMIN_SESSION_SECRET`, `MARKETPLACE_ENABLED`, `EXPRESS_ENABLED`,
   `APP_ORIGIN`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_EXPRESS_TEMPLATE` and `WHATSAPP_ACCESS_TOKEN`. Missing gates fail
   closed. Secret values were not read, so Stripe key mode, DOP presentment and
   settlement, webhook destination/signature, and WhatsApp sender/template are
   **unverified**. Supabase Auth email-code template, delivery and settings are
   also unverified. Do not set release attestations without external evidence.
4. **Payment-capable hosting constraint.** The existing Vercel team is Hobby.
   [Vercel's Hobby policy restricts commercial deployments](https://vercel.com/docs/limits/fair-use-guidelines),
   including requesting or processing payments. Under the owner's $0 additional
   monthly-cost rule, paid Express cannot be declared launch-ready on that plan.
   Existing unpaid/free paths can be evaluated separately, but a reduced-scope
   release is not the full 2.0 acceptance contract.

Missing isolated staging infrastructure is **not** itself a production defect.
It limits evidence: hosted Auth, PostgREST/RLS, Storage, Stripe, WhatsApp,
refund/settlement, and device flows are not verified by local fixtures. The
existing production project must never receive synthetic test writes.

## Release package and safe order

1. Keep every release/legacy payment and edit gate false. Privately confirm a
   current backup, operator, production migration ledger/catalog, and the exact
   forward-repair sequence. Review live function dependencies and existing
   grants before applying the privilege and worker-privacy repairs.
2. Select only the required additive candidates in dependency order:
   `202610071200_marketplace_foundation`,
   `202610081400_worker_availability`,
   `202610081600_worker_public_privacy`,
   `202610091200_marketplace_lifecycle`,
   `202610091300_express_fulfillment`,
   `202610101200_ingestion_budget`, plus the new legacy-RPC privilege repair.
   Do not bulk-apply historical migrations or seed data. Abort on catalog or
   duplicate-phone conflicts without deleting customer rows.
3. Configure only the existing Vercel project after explicit approval. Verify
   the Supabase URL points to the intended production ref and that private keys
   remain server-side. Configure distinct admin credentials, Auth redirect/email
   behavior, Stripe webhook/settlement, WhatsApp sender/template/consent, exact
   public origin and operational owners; validate without printing credentials.
   Gate activation follows evidence, never mere variable presence.
4. Push/deploy only with separate explicit authorization after the production
   repair and configuration review. Inspect the resulting deployment and its
   runtime/headers, then conduct read-only smoke checks first. Do not call a
   disabled or untested flow verified.

## Local regression evidence

- Node 24.21.0: 70 synthetic unit/integration/security tests passed, including
  the new legacy-RPC privilege regression.
- Lint and typecheck passed; production build compiled and generated 167 pages.
- Production dependency audit: 0 vulnerabilities. Full audit: 7 high
  development-tool entries from the documented `braces` advisory; the
  hash-pinned installed-byte mitigation passed its exploit tests.
- Security scan passed on Node 24: 1,700 repository files and 76 browser chunks
  scanned, with no detected embedded credentials or server-secret references.
- Synthetic desktop/mobile Chromium browser suite: 52/52 passed. The
  localhost production-server smoke passed public routes, seven admin
  guards including middleware-bypass probes, default-off legacy and payment
  containment, and image optimizer denial. Fixtures do not establish hosted
  provider behavior or physical-device/Safari compatibility.

The exact next authorized production step is a reviewed repair window for the
two live security exposures, with backup and read-only catalog evidence in hand.
Full 2.0 launch still requires the other production conditions above.
