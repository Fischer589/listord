# RD$149 Featured Opportunity production activation

Target Supabase project: `rkgtykbekaeruyhdmvbo`. Production site: `listordapp.com` on Netlify. Do not run `supabase db push`: older local migration filenames do not match the production migration ledger.

## 1. Establish the database state

In that project's Supabase SQL Editor, run this read-only query:

```sql
select to_regclass('public.marketplace_featured_orders') as orders,
  to_regprocedure('public.marketplace_featured_reserve(uuid,uuid)') as reserve,
  to_regprocedure('public.marketplace_featured_paid(uuid,text,text,text,timestamptz)') as paid,
  to_regprocedure('public.marketplace_featured_fail(uuid,text)') as fail,
  to_regprocedure('public.marketplace_featured_refund(uuid,text,text,text)') as refund;
select version, name from supabase_migrations.schema_migrations
  where name ilike '%marketplace_featured%' order by version;
```

If all five objects are absent, apply the **entire exact SQL** in [`supabase/migrations/202610131200_marketplace_featured.sql`](../supabase/migrations/202610131200_marketplace_featured.sql) once, using the project's authorized migration mechanism. The SQL Editor can execute that one transaction if the established hosted migration mechanism is unavailable; record and reconcile its applied version in the production migration ledger before any future CLI migration. If only some objects exist, stop and compare the live definitions with the file. Do not replay older migrations or the full schema.

If the objects already exist but REST still reports `PGRST205`, run `NOTIFY pgrst, 'reload schema';` in the SQL Editor and recheck REST. A missing object means the migration has not been applied to this project; an existing object with `PGRST205` points to an API schema-cache or exposure problem.

## 2. Verify schema and access

After application, run:

```sql
select c.relname, c.relrowsecurity from pg_class c
  where c.oid = 'public.marketplace_featured_orders'::regclass;
select indexname, indexdef from pg_indexes
  where schemaname = 'public' and tablename = 'marketplace_featured_orders'
  order by indexname;
select role, has_table_privilege(role, 'public.marketplace_featured_orders', 'SELECT') as can_select,
  has_function_privilege(role, 'public.marketplace_featured_reserve(uuid,uuid)', 'EXECUTE') as can_reserve,
  has_function_privilege(role, 'public.marketplace_featured_paid(uuid,text,text,text,timestamptz)', 'EXECUTE') as can_mark_paid
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role);
```

Expected: RLS `true`; primary key plus unique pending, active, and owner indexes; `anon` and `authenticated` false for table SELECT and both RPCs; `service_role` true. Check that each of the four RPCs exists. A public REST zero-row request should change from `404/PGRST205` to `401/42501`; a service-role zero-row request should succeed. Do not expose the service-role key in a browser, log, or command output.

## 3. Verify payment configuration, then activate

In Stripe Dashboard, confirm that the production secret key is live mode, the webhook endpoint is `https://listordapp.com/api/stripe/webhook`, its signing secret matches Netlify's `STRIPE_WEBHOOK_SECRET`, and the endpoint delivers `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`. Verify existing Workspace events before changing Featured gates. Do not make a charge for this check.

Only after schema, privileges, REST, and Stripe settings pass, set these **Netlify production Function** variables to `true`: `FEATURED_OPPORTUNITIES_ENABLED`, `FEATURED_CHECKOUT_ENABLED`, `FEATURED_LIVE_PAYMENTS_ENABLED`. Keep `APP_ORIGIN=https://listordapp.com` and the existing Workspace variables. Deploy the current `release-candidate` commit, then verify the production deploy SHA, public `/api/marketplace` response, authenticated owner's purchase control, unauthenticated checkout rejection, and invalid-signature webhook rejection. Do not interpret a Checkout return URL as payment confirmation; only the signed webhook can activate placement.

An active paid opportunity that closes is removed from the public board immediately. The admin marketplace view flags paid placements on no-longer-public opportunities for owner review; no automatic refund or extension occurs.
