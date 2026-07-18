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
  editToken: string;
  workerId: string;
  fullName: string;
};

/**
 * Looks up an existing worker profile by (normalized) WhatsApp number.
 * Shared by the registration duplicate-detection screen and the profile
 * edit-link recovery flow so both surfaces use one ownership mechanism.
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
    .select("id, edit_token, full_name, whatsapp_number")
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

  if (!worker?.edit_token || !isValidEditToken(worker.edit_token)) {
    return null;
  }

  return {
    editToken: worker.edit_token,
    workerId: worker.id,
    fullName: worker.full_name || "tu perfil"
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
