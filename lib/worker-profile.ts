import { normalizeWorkerPhoto, workerPhotoPath, MAX_PHOTO_BYTES, PHOTO_ERROR_MESSAGE } from "./worker-photo";
import { getSupabaseAdminClient } from "./supabase-admin";
import type { WorkStyle } from "./types";
import { normalizeWhatsAppNumber as normalizeSharedWhatsAppNumber } from "./whatsapp";

export const workStyleLabelToValue = {
  Estructurado: "structured",
  Creativo: "creative",
  "Manual / práctico": "hands_on",
  "Trato con personas": "people_oriented",
  "Sistemas / técnico": "systems_oriented",
  "Rápido / dinámico": "fast_paced",
  Detallista: "detail_oriented",
  Flexible: "flexible"
} satisfies Record<string, WorkStyle>;

export const workStyles: Array<{ value: WorkStyle; label: string }> =
  Object.entries(workStyleLabelToValue).map(([label, value]) => ({
    label,
    value
  }));

const workStyleValues = new Set<WorkStyle>(Object.values(workStyleLabelToValue));

const blockedTerms = [
  "fuck",
  "shit",
  "bitch",
  "puta",
  "puto",
  "mierda",
  "coño",
  "carajo",
  "maldito"
];

export const workerPhotosBucket =
  process.env.WORKER_PHOTOS_BUCKET?.trim() || "worker-photos";
export function getText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export function getWorkStyleValue(value: string) {
  return workStyleValues.has(value as WorkStyle) ? (value as WorkStyle) : null;
}

export function getList(formData: FormData, key: string) {
  return getText(formData, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeWhatsAppNumber(value: string) {
  return normalizeSharedWhatsAppNumber(value);
}

export function isValidEditToken(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export function formatWhatsAppNumber(value: string) {
  return normalizeWhatsAppNumber(value);
}

export type ExistingWorkerLookup = {
  workerId: string;
};

/**
 * Looks up an existing worker profile by (normalized) WhatsApp number.
 * Used only for duplicate detection. A phone match is NOT proof of ownership
 * and must never return a bearer edit token or recover an edit link.
 */
export async function findWorkerByWhatsAppNumber(
  whatsappNumber?: string
): Promise<ExistingWorkerLookup | null> {
  const normalizedWhatsAppNumber = normalizeWhatsAppNumber(
    whatsappNumber?.trim() || ""
  );

  if (!normalizedWhatsAppNumber) {
    return null;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    console.warn("Worker lookup by WhatsApp skipped: Supabase admin client unavailable.");
    return null;
  }

  const { data, error } = await supabase
    .from("workers")
    .select("id, whatsapp_number")
    .not("whatsapp_number", "is", null);

  if (error) {
    console.warn("Worker lookup by WhatsApp failed.", { code: error.code });
    return null;
  }

  const worker = (data ?? []).find((row) => {
    const existingNumber =
      typeof row.whatsapp_number === "string"
        ? normalizeWhatsAppNumber(row.whatsapp_number)
        : null;

    return existingNumber === normalizedWhatsAppNumber;
  });

  if (!worker) {
    return null;
  }

  return {
    workerId: worker.id
  };
}

export function hasBlockedText(values: string[]) {
  const text = values.join(" ").toLowerCase();

  return blockedTerms.some((term) => text.includes(term));
}

export function getMissingProfileQualityFields(worker: {
  short_intro?: string | null;
  skills?: string[] | null;
  photo_url?: string | null;
}) {
  const missingFields: string[] = [];

  if (!worker.short_intro?.trim()) {
    missingFields.push("short_intro");
  }

  if (!Array.isArray(worker.skills) || worker.skills.length === 0) {
    missingFields.push("skills");
  }

  if (!worker.photo_url?.trim()) {
    missingFields.push("photo");
  }

  return missingFields;
}

export async function uploadWorkerPhoto(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  photo: FormDataEntryValue | null,
  workerId: string
): Promise<{ url: string | null; error?: string }> {
  if (photo === null || (typeof photo !== "string" && photo.size === 0 && !photo.name)) {
    return { url: null };
  }
  if (typeof photo === "string" || photo.size === 0 || photo.size > MAX_PHOTO_BYTES) {
    return { url: null, error: PHOTO_ERROR_MESSAGE };
  }
  try {
    const normalized = await normalizeWorkerPhoto(Buffer.from(await photo.arrayBuffer()), photo.type);
    const path = workerPhotoPath(workerId, normalized.hash);
    const bucket = supabase.storage.from(workerPhotosBucket);
    const { error } = await bucket.upload(path, normalized.data, {
      contentType: "image/webp", cacheControl: "31536000", upsert: false
    });
    // Content-addressed paths scoped to an opaque worker ID make retries idempotent.
    // This SDK's upload method returns raw API JSON (statusCode); other storage
    // methods can return StorageApiError (status). Support both exact shapes.
    const status = error && "statusCode" in error ? Number(error.statusCode)
      : error && "status" in error ? Number(error.status) : undefined;
    const alreadyExists = error && (status === 409 || (
      status === 400 && error.message === "The resource already exists"
    ));
    if (error && !alreadyExists) {
      return { url: null, error: PHOTO_ERROR_MESSAGE };
    }
    const { data } = bucket.getPublicUrl(path);
    return data.publicUrl ? { url: data.publicUrl } : { url: null, error: PHOTO_ERROR_MESSAGE };
  } catch {
    // Do not log file contents, phone numbers, object paths or decoder internals.
    return { url: null, error: PHOTO_ERROR_MESSAGE };
  }
}
