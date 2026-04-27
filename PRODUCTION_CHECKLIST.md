# ListoRD Production Checklist

## Environment

- Set `NEXT_PUBLIC_SUPABASE_URL` in Vercel.
- Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel.
- Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel as a private server-side variable.
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEEKLY_PRICE_ID`, and `STRIPE_MONTHLY_PRICE_ID`.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_*` variable.
- Keep service role keys only in private server-side environments when needed.
- Confirm `NEXT_PUBLIC_SUPABASE_URL` uses `https://`.

## Supabase

- Run `supabase/schema.sql` or all migrations in `supabase/migrations`.
- Enable Row Level Security on all public tables.
- Confirm policies allow public worker browsing but restrict profile/contact updates.
- Create the Storage bucket for worker photos.
- Configure Storage policies before accepting public uploads.
- Seed or publish real worker records before launch.

## App Safety

- `npm run typecheck` passes.
- `npm run build` passes.
- No service role key is present in `.env.local`, Vercel public env, browser bundles, or logs.
- Missing Supabase config shows an empty state, not demo workers.
- Error, loading, and 404 pages render correctly.
- Server actions validate required inputs before writing to Supabase.

## SEO And UX

- Metadata title and description are set.
- Open Graph metadata is set.
- The homepage is mobile-first and readable on small screens.
- Worker cards have bounded image sizes and do not cause layout shift.
- Contact buttons are large enough for touch.

## Deployment

- Deploy to Vercel from the production branch.
- Add production environment variables before first deploy.
- Verify the deployed homepage loads CSS and `_next/static` assets.
- Verify Supabase queries return workers in production.
- Verify contact request and hiring outcome flows with test accounts.
- Verify Stripe sends `checkout.session.completed` to `/api/stripe/webhook`.
- Review npm audit output and upgrade vulnerable packages before public launch.
