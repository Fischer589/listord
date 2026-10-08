# Worker photo pipeline

New uploads follow: form → size check → server decoder → orientation/resize →
WebP → existing Supabase bucket → stored public URL → direct browser delivery.
`images.unoptimized: true` remains enabled. This does not rewrite existing photos.

- Accept JPG/PNG/WebP up to 4 MiB, with both browser and server size checks.
  Decode actual content and require its format to match the declared MIME type.
  Reject empty, corrupt, mismatched, animated/multipage or over-40-megapixel files.
- Apply EXIF orientation, fit inside 800×800 preserving aspect ratio, do not
  upscale, encode WebP quality 80, strip metadata. Decoder timeout: 10 seconds.
- Use `profiles/<worker UUID>/<SHA-256 of output>.webp`. No phone number or input
  filename in new object keys. No URL fetching or arbitrary filesystem access.
- Upload only the normalized output, with `image/webp`, one-year caching and
  `upsert: false`. Identical retries use the same path; recognize explicit duplicate
  responses without treating other failures as success. No original copy uploaded.
- Registration may succeed without its optional photo but displays an explicit
  warning. Edit-photo failure prevents the profile update and retains the previous
  reference. A storage success followed by a database failure can leave an
  unreferenced object; no destructive cleanup is automatic. Same-worker retries
  reuse the deterministic path.
- Existing CSS controls responsive framing/cropping. The native decoder is only
  imported by server code; the browser file input imports a small size policy.

The previous advertised 5 MB limit exceeded [Vercel's 4.5 MB request limit](https://vercel.com/docs/functions/limitations)
and Next's default server-action limit. The new 4 MiB input cap plus a 4,400,000-byte
action-body limit leaves room for form fields. Larger-file staging/direct-upload
infrastructure is outside this checkpoint; the browser rejects oversize selection
before submission. Existing larger stored photos remain readable.

Tests cover landscape/portrait/small/square images, rotation, metadata stripping,
invalid inputs, pixel limits, deterministic paths, storage errors, and the installed
Supabase SDK against mocked HTTP responses. The renderer tests ensure images still
bypass the optimizer. Production upload, caching headers and Node 24 native-binary
compatibility still require staging verification.

## Existing-photo migration is intentionally not run

There are stable legacy Supabase URLs, some with phone-number path segments, and
Unsplash references. Preserve them. Inventory objects and reference counts with
authorized read-only access first; do not run seed scripts or guess object paths.

If a future approved backfill is needed: process only allowlisted bucket objects,
write a resumable old/new mapping, verify each normalized object, compare-and-set
only the unchanged old reference, retain originals and stop on failed verification.
Never fetch arbitrary worker-provided URLs server-side. Public photo deletion and
cache policy need separate operational review; one-year caching suits immutable
public profile images but cannot guarantee immediate removal from browser caches.
