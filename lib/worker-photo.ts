import { createHash } from "node:crypto";
import sharp from "sharp";
import { MAX_PHOTO_BYTES, PHOTO_ERROR_MESSAGE } from "./photo-policy";
export { MAX_PHOTO_BYTES, PHOTO_ERROR_MESSAGE } from "./photo-policy";

const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };

export class WorkerPhotoError extends Error {
  constructor() {
    super(PHOTO_ERROR_MESSAGE);
    this.name = "WorkerPhotoError";
  }
}

/** Bytes only: this pipeline never fetches a URL or opens an input filename. */
export async function normalizeWorkerPhoto(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES || !Object.hasOwn(formats, mime)) {
    throw new WorkerPhotoError();
  }
  try {
    const input = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning", sequentialRead: true });
    const metadata = await input.metadata();
    if (metadata.format !== formats[mime] || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
      throw new WorkerPhotoError();
    }
    // rotate() applies EXIF orientation. Sharp strips metadata by default.
    const { data, info } = await input.rotate()
      .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .timeout({ seconds: 10 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, hash: createHash("sha256").update(data).digest("hex") };
  } catch {
    throw new WorkerPhotoError();
  }
}

export function workerPhotoPath(workerId: string, hash: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workerId) || !/^[0-9a-f]{64}$/.test(hash)) {
    throw new WorkerPhotoError();
  }
  return `profiles/${workerId}/${hash}.webp`;
}
