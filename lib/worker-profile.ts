import { getSupabaseAdminClient } from "./supabase-admin";
import type { WorkStyle } from "./types";

export const workStyles: Array<{ value: WorkStyle; label: string }> = [
  { value: "structured", label: "Organizado y con reglas claras" },
  { value: "creative", label: "Creativo" },
  { value: "hands_on", label: "Fisico / practico" },
  { value: "people_oriented", label: "Con personas" },
  { value: "systems_oriented", label: "Procesos o sistemas" },
  { value: "fast_paced", label: "Rapido y movido" },
  { value: "detail_oriented", label: "Detallado" },
  { value: "flexible", label: "Flexible" }
];

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
  "image/webp",
  "image/gif"
]);

export function getText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export function getList(formData: FormData, key: string) {
  return getText(formData, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10 && /^(809|829|849)/.test(digits)) {
    return `1${digits}`;
  }

  if (digits.length === 11 && /^1(809|829|849)/.test(digits)) {
    return digits;
  }

  return null;
}

export function isValidEditToken(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export function formatWhatsAppNumber(value: string) {
  const normalized = normalizeWhatsAppNumber(value);

  return normalized ? `+${normalized}` : null;
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
