import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MAX_PHOTO_BYTES, normalizeWorkerPhoto, workerPhotoPath } from "../lib/worker-photo";
import { uploadWorkerPhoto } from "../lib/worker-profile";
import { createClient } from "@supabase/supabase-js";

const workerId = "142a112a-3333-4444-8888-123456789012";
const makeImage = (width = 1600, height = 1200) => sharp({ create: { width, height, channels: 3, background: "#287b50" } });

test("normalizes varying dimensions once without distortion or upscaling", async () => {
  for (const [width, height] of [[1600, 1200], [1200, 1600], [200, 100], [800, 800]]) {
    const original = await makeImage(width, height).png().toBuffer();
    const normalized = await normalizeWorkerPhoto(original, "image/png");
    const result = await sharp(normalized.data).metadata();
    assert.equal(result.format, "webp");
    assert.ok(normalized.width <= 800 && normalized.height <= 800);
    assert.ok(normalized.width <= width && normalized.height <= height);
    assert.equal(normalized.width / normalized.height, width / height);
    assert.equal(result.exif, undefined);
  }
});

test("corrects orientation and strips embedded metadata", async () => {
  const input = await makeImage(1200, 600).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const output = await normalizeWorkerPhoto(input, "image/jpeg");
  assert.equal(output.width, 400);
  assert.equal(output.height, 800);
  const metadata = await sharp(output.data).metadata();
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
});

test("rejects spoofed MIME, corrupt images, empty data, oversized files and pixel bombs", async () => {
  const png = await makeImage().png().toBuffer();
  for (const [bytes, mime] of [
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/png"],
    [Buffer.from("not a photo"), "image/jpeg"],
    [png, "image/jpeg"], [png, "text/html"], [Buffer.alloc(0), "image/png"],
    [Buffer.alloc(MAX_PHOTO_BYTES + 1), "image/png"],
    [png.subarray(0, png.length / 2), "image/png"]
  ] as const) await assert.rejects(normalizeWorkerPhoto(bytes, mime), /No pudimos guardar/);
  const huge = await makeImage(6400, 6400).png().toBuffer();
  await assert.rejects(normalizeWorkerPhoto(huge, "image/png"), /No pudimos guardar/);
});

test("paths are deterministic, worker-scoped and contain no source filename or phone", async () => {
  const bytes = await makeImage().webp().toBuffer();
  const first = await normalizeWorkerPhoto(bytes, "image/webp");
  const second = await normalizeWorkerPhoto(bytes, "image/webp");
  assert.equal(first.hash, second.hash);
  assert.equal(workerPhotoPath(workerId, first.hash), `profiles/${workerId}/${first.hash}.webp`);
  assert.throws(() => workerPhotoPath("../secret", first.hash));
  assert.throws(() => workerPhotoPath("18091234567", first.hash));
  assert.throws(() => workerPhotoPath(workerId, "../../file"));
});

test("storage receives only normalized bytes with immutable caching; failure is explicit", async () => {
  const input = await makeImage().jpeg().toBuffer();
  const file = new File([new Uint8Array(input)], "private-name.jpg", { type: "image/jpeg" });
  let uploadError: { status: number; message: string } | null = null;
  let uploaded = 0;
  const bucket = {
    async upload(path: string, bytes: Buffer, options: Record<string, unknown>) {
      uploaded++;
      assert.match(path, /^profiles\/[\da-f-]+\/[\da-f]{64}\.webp$/);
      assert.equal((await sharp(bytes).metadata()).format, "webp");
      assert.deepEqual(options, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      return { error: uploadError };
    },
    getPublicUrl(path: string) { return { data: { publicUrl: `https://storage.example/${path}` } }; }
  };
  const client = { storage: { from: () => bucket } } as unknown as Parameters<typeof uploadWorkerPhoto>[0];
  const first = await uploadWorkerPhoto(client, file, workerId);
  assert.ok(first.url);
  uploadError = { status: 409, message: "The resource already exists" };
  assert.deepEqual(await uploadWorkerPhoto(client, file, workerId), first);
  uploadError = { status: 500, message: "Storage unavailable" };
  assert.ok((await uploadWorkerPhoto(client, file, workerId)).error);
  assert.deepEqual(await uploadWorkerPhoto(client, null, workerId), { url: null });
  assert.ok((await uploadWorkerPhoto(client, "https://internal.example", workerId)).error);
  assert.equal(uploaded, 3, "absent/invalid files never reach storage");
});

test("retry handling follows the installed Supabase SDK error shape", async () => {
  const bytes = await makeImage(100, 100).jpeg().toBuffer();
  const file = new File([new Uint8Array(bytes)], "photo.jpg", { type: "image/jpeg" });
  for (const status of [400, 409, 500]) {
    const client = createClient("https://fixture.supabase.co", "test-only-key", {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: async () => new Response(JSON.stringify({ statusCode: String(status), error: "Duplicate", message: "The resource already exists" }), { status, headers: { "Content-Type": "application/json" } }) }
    });
    const result = await uploadWorkerPhoto(client, file, workerId);
    if (status === 500) assert.ok(result.error);
    else assert.ok(result.url?.endsWith(".webp"));
  }
});
