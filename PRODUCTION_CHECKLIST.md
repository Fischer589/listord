# ListoRD production acceptance checklist

Current decision and evidence: [2026-10-11 production handoff](docs/PRODUCTION_RELEASE_HANDOFF_2026-10-11.md).
Earlier detail: [security repair record](docs/PRODUCTION_SECURITY_REPAIR_2026-10-10.md)
and [2.0 schema impact review](docs/PRODUCTION_2_SCHEMA_IMPACT_2026-10-10.md).
Earlier deployment handoff: [2026-10-10 checkpoint](docs/PRODUCTION_DEPLOYMENT_HANDOFF_2026-10-10.md).
Earlier implementation checkpoint: [release preparation](docs/RELEASE_PREPARATION_2026-10-10.md).
The owner authorized the completed narrow hotfix and non-destructive migrations.
Full 2.0 activation and deployment still require their release acceptance evidence.
Prompt 4 release procedure: [production handoff](docs/PRODUCTION_RELEASE_HANDOFF_2026-10-11.md#production-deployment-and-rollback-procedure).
Worker recovery: [ownership and consent runbook](docs/WORKER_OWNERSHIP_CONSENT_RUNBOOK_2026-10-11.md).
Commercial decision: [Express terms draft](docs/EXPRESS_TERMS_FOR_OWNER_APPROVAL_2026-10-11.md).
Meta WhatsApp Business API configuration is deferred from the current launch;
click-to-WhatsApp contact remains available. Keep paid Express and automated
outreach closed until operational fulfillment is approved and verified.

## Required before production acceptance

- Preserve the existing auditor role/configuration, TLS `verify-full`, CA and read-only
  privileges. The owner waived a newly verified backup for the narrow security repairs;
  database password access remains unavailable for `pg_dump`.
- The security repairs and reviewed additive 2.0 migrations are applied.
  The incompatible normalized-phone unique index was retired. Shared phones
  remain valid for distinct worker IDs; no profiles were deleted or merged.
- Never run `supabase/schema.sql`, seeds or all historical migrations against production.
  Review only explicitly selected candidates against actual deployed state.
- The privileged-RPC and worker privacy repairs are applied and verified.
  The fail-closed legacy outcome and contact API hotfix is live as Vercel
  deployment `dpl_4iVv4nQ5yxVBeg4Nk5sbzNkKb7S6`. Do not use production
  for synthetic valid contact or registration writes.
- Resolve exposed-token containment/recovery, verified ownership/outcomes, durable abuse
  controls, admin access and real storage permissions. Never use a shared phone
  as proof of worker ownership.
- Preserve payment history and existing entitlements; verify historical webhook replay
  and idempotency in Stripe sandbox before any new payment behavior is accepted.
- Keep `MARKETPLACE_ENABLED`, `EXPRESS_ENABLED`, `WORKER_AVAILABILITY_RENEWAL_ENABLED`, `LEGACY_WORKER_EDIT_ENABLED` and
  `LEGACY_CHECKOUT_ENABLED` false. These production variables and `EXPRESS_OUTREACH_ACCEPTED=false`
  were added to the existing Vercel project; the current deployed hotfix was not rebuilt.
  Express checkout stays disabled and its purchase controls are hidden in the 2.0 app.
- Complete the full 2.0 acceptance contract in `LISTORD_2_RELEASE.md`; disabled incomplete
  features are not successful acceptance.
- Retain and verify the hash-pinned braces mitigation on every clean installation;
  review `docs/BRACES_SECURITY_MITIGATION.md`. Upstream npm still reports seven high
  entries; runtime audit is clean. Never bypass guards or describe raw audit as clean.
- Confirm actual Vercel Node 24 configuration, hosting pause state, image behavior and
  source-image caching. Do not infer production mitigation from a local build.
- The owner's backup waiver and authorization for the completed non-destructive
  schema package and security-only deployment are recorded. The full 2.0 app
  has not been authorized for promotion without release acceptance.

## Reproducible local verification (Node 24)

Use the version in `.nvmrc`. Install with `npm ci`. No production credentials are needed.
Run build and standalone typecheck sequentially; both use generated `.next/types`.

```sh
npm test
npm run lint
npm run build
npm run typecheck
npm run test:e2e:request
npm run security:check
npm audit --omit=dev
npm audit
```

For `npm run smoke:foundation`, start the production server on `127.0.0.1:3187`
with Supabase service and Stripe credentials blank and all gates false. The script
only targets localhost. Browser fixtures explicitly blank service/Stripe keys.
Do not treat fixture pass counts as hosted RLS, payment, physical-device or Safari evidence.
