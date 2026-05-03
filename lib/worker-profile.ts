import { getSupabaseAdminClient } from "./supabase-admin";
import type { WorkStyle } from "./types";

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
export const maxPhotoSizeBytes = 5 * 1024 * 1024;
export const allowedPhotoTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

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
  const trimmedValue = value.trim();
  const digits = value.replace(/\D/g, "");

  if (digits.length < 10) {
    return null;
  }

  if (trimmedValue.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return `+${digits}`;
}

export function isValidEditToken(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export function formatWhatsAppNumber(value: string) {
  return normalizeWhatsAppNumber(value);
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

export function getPhotoExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension && /^[a-z0-9]+$/.test(extension)) {
    return extension;
  }

  return file.type.split("/").pop() || "jpg";
}

export async function uploadWorkerPhoto(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  photo: FormDataEntryValue | null,
  normalizedWhatsAppNumber: string
) {
  if (!(photo instanceof File) || photo.size === 0) {
    return null;
  }

  if (!allowedPhotoTypes.has(photo.type) || photo.size > maxPhotoSizeBytes) {
    return null;
  }

  const path = [
    normalizedWhatsAppNumber,
    `${Date.now()}-${crypto.randomUUID()}.${getPhotoExtension(photo)}`
  ].join("/");

  try {
    const { error: uploadError } = await supabase.storage
      .from(workerPhotosBucket)
      .upload(path, photo, {
        contentType: photo.type,
        upsert: false
      });

    if (uploadError) {
      console.warn("Worker profile photo upload failed.", {
        code: uploadError.name,
        message: uploadError.message
      });
      return null;
    }

    const { data } = supabase.storage
      .from(workerPhotosBucket)
      .getPublicUrl(path);

    return data.publicUrl || null;
  } catch (error) {
    console.warn("Worker profile photo upload failed.", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "UnknownError"
    });
    return null;
  }
}
