# ListoRD production acceptance checklist

Current decision and evidence: [release preparation](docs/RELEASE_PREPARATION_2026-10-10.md).
Local verification does not authorize a migration, worker activation, push or deployment.

## Required before production acceptance

- Preserve the existing auditor role/configuration, TLS `verify-full`, CA and read-only
  privileges. Database authentication is an external blocker; do not reset credentials.
- Complete authorized read-only catalog/grant/migration reconciliation with
  `supabase/preflight_worker_privacy.sql`; review private function bodies privately.
- Never run `supabase/schema.sql`, seeds or all historical migrations against production.
  Review only explicitly selected candidates against actual deployed state.
- Validate candidate migrations against a production-equivalent hosted Supabase staging
  environment using synthetic records; verify rollback and untouched legacy records.
- Resolve exposed-token containment/recovery, verified ownership/outcomes, durable abuse
  controls, admin access, real storage permissions and normalized-phone uniqueness.
- Preserve payment history and existing entitlements; verify historical webhook replay
  and idempotency in Stripe sandbox before any new payment behavior is accepted.
- Keep `MARKETPLACE_ENABLED`, `EXPRESS_ENABLED`, `WORKER_AVAILABILITY_RENEWAL_ENABLED`, `LEGACY_WORKER_EDIT_ENABLED` and
  `LEGACY_CHECKOUT_ENABLED` false. Express checkout stays disabled.
- Complete the full 2.0 acceptance contract in `LISTORD_2_RELEASE.md`; disabled incomplete
  features are not successful acceptance.
- Retain and verify the hash-pinned braces mitigation on every clean installation;
  review `docs/BRACES_SECURITY_MITIGATION.md`. Upstream npm still reports seven high
  entries; runtime audit is clean. Never bypass guards or describe raw audit as clean.
- Confirm actual Vercel Node 24 configuration, hosting pause state, image behavior and
  source-image caching. Do not infer production mitigation from a local build.
- Record backup, forward-repair plan and explicit production migration/deployment approval.

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
