# Image optimization audit — October 7, 2026

## Evidence and root cause

User-verified 30-day usage: 10,062 transformations / 5,000 included;
121,446 image cache writes / 100,000 included; spike October 5–7;
team deployments paused. These totals are supplied evidence, not independently
recomputed project metrics.

The confirmed application mechanism is the default Next.js image optimizer on
public worker photos. It creates separately cached size/quality/format variants
when requested. The exact cause and traffic source of the October spike remain
unproven.

- `next.config.mjs` previously enabled the default optimizer with broad HTTPS
  host allowlists for Unsplash and the configured Supabase host, without path or
  query restrictions. This also exposed allowed remote images to direct optimizer
  requests beyond the images rendered by the UI.
- `components/worker-card.tsx` and `app/trabajador/[slug]/page.tsx` use `next/image`
  with `fill` and viewport-based `sizes`. Next 14.2.3's fixed candidate widths for
  both public configurations are 640, 750, 828, 1080, 1200, 1920, 2048 and 3840.
  A browser normally selects one candidate; this is not eight transformations
  on every view. Different devices or direct requests can request more variants.
  There is no continuously varying width calculation or custom image loader.
- `app/admin/workers/page.tsx` already uses `unoptimized`. Public card photos are
  lazy loaded; the profile hero has priority. `worker-discovery.tsx` renders all
  matching workers; `lib/workers.ts` has no explicit pagination. This increases
  exposure as visitors browse, but does not itself prove the spike's cause.
- `lib/worker-profile.ts` creates a timestamp/UUID object path **on upload only**,
  saves a public Supabase URL, and does not mint signed URLs on render. No
  render-time cache-busting query parameters were found. Seed Unsplash URLs have
  stable `auto=format&fit=crop&w=600&q=80` parameters.
- Uploads permit JPEG/PNG/WebP up to 5 MB, without resizing. Supabase storage-js's
  installed default upload cache-control is 3,600 seconds; the app does not
  override it. Next 14.2.3's default minimum image TTL is 60 seconds, with actual
  expiry also depending on upstream headers. Production object headers were not
  sampled, so actual TTLs and repeat transformations are not established.
- Page `noStore()` / `revalidate = 0` are separate from the image cache; they do
  not establish image-cache invalidation on every page request.
- The host-wide optimizer allowlists and public discovery/profile routes make
  automated image requests a plausible amplifier. Middleware only matches admin
  routes. No evidence establishes bot abuse, malicious quality/URL variations,
  or any particular user agent as the cause.

Read-only Vercel checks found ListoRD's latest production deployment
`dpl_2xtzpCpvMs49rBKyRcmif93yXdQM`, created July 20 UTC, at commit
`1a54b1f9a8b3f94e1dbd2a1feabbd74228f34745`, matching the audit's initial checkout.
The October 5–7 historical runtime-log query was rejected because Hobby retention
does not cover that interval; a recent 30-minute query returned no groups.
A separate image-metric query returned HTTP 400 and provided no usage data.
Runtime function logs alone would not establish image-edge traffic attribution.

Vercel bills image cache writes in **8 KB units**, not one unit per cached image
or HTTP request. The supplied write/transform ratio is therefore not evidence of
a cache-miss loop. See [image pricing](https://vercel.com/docs/image-optimization/limits-and-pricing),
[cost controls](https://vercel.com/docs/image-optimization/managing-image-optimization-costs),
and [Next 14 image behavior](https://nextjs.org/docs/14/app/api-reference/components/image).

## Smallest mitigation

Set `images.unoptimized: true` globally. Existing `next/image` components emit
original source URLs, without optimizer URLs or generated variant srcsets.
Responsive fill, CSS cropping, alt text, lazy card loading, priority profile
loading and missing-photo initials remain in place. Marketplace logic, database,
uploads and stored URLs are unchanged. No new service or dependency is added.

Global configuration also disables the built-in Next 14 optimizer handler,
unlike only adding component-level props. Narrower size lists or longer TTLs
would reduce usage without eliminating transformations and writes; they would
not provide the same protection during an unexplained traffic spike.

Tradeoff: visitors download source images directly from Supabase/Unsplash, so
large uploads can increase origin bandwidth and mobile download time. Responsive
layout is preserved, but responsive file-size selection is intentionally removed.
Upload-time resizing can be evaluated separately if source bandwidth warrants it.

## Verification and deployment follow-up

`npm test` exercises the actual Next Image renderer with project configuration
for card, profile and admin image props against Supabase and Unsplash fixtures.
It checks exact source URLs, absence of optimizer/srcset URLs, responsive fill,
alt text and lazy/priority behavior. These are renderer regression checks, not a
live database or browser end-to-end test.

Results: all six renderer cases passed; `npm run typecheck` passed;
`npm run build` passed and generated 163 static pages. The first sandboxed build
failed during webpack compilation without detailed diagnostics; the build outside
the sandbox succeeded. The production image manifest records `unoptimized: true`.
Local production HTTP smoke checks returned 200 for `/`,
`/categorias/limpiadora`, `/trabajadores/registro` and `/empleadores`, and 404 for
direct Unsplash optimizer requests at widths 640 and 3840. Localhost listen/fetch
required execution outside the sandbox. Supabase credentials are not configured
locally; live worker records, external image delivery and payment flows were not
tested. Existing warnings include missing Supabase server configuration, stale
Browserslist data and React's `fetchPriority` warning in the image renderer tests.

After deployments are permitted again, an authorized deployment of this commit
is required for production to change. No push, deployment, plan upgrade, cache
purge, firewall change or database mutation is part of this work. Existing usage
is not reversed. Old deployment URLs and already-open pages may still reference
optimized images; verify production HTML/network requests and platform handling
of `/_next/image` after deployment. Monitor new transformation/write usage and
source bandwidth, and inspect retained edge-request dimensions (URL, width,
quality, cache result and user agent) if unexplained usage continues.
