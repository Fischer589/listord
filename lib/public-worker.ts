/** Public previews must not carry contact details hidden inside editable text. */
export function publicWorkerText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text) return "";
  if (/(?:\+?\d[\s().-]*){8,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:https?:\/\/|www\.|wa\.me\/|api\.whatsapp\.com|t\.me\/)|\b(?:whatsapp|instagram|telegram|facebook|arroba)\b|@[a-z0-9_.]{3,}/i.test(text)) return "";
  return text;
}

function publicPhotoUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const storageHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname; } catch { return ""; } })();
    if (url.protocol !== "https:" || ![storageHost, "images.unsplash.com"].includes(url.hostname) || url.username || url.password || url.search || url.hash ||
        /@|\d{10,}|(?:\d[\s().]*){10,}|wa\.me|whatsapp|telegram/i.test(url.pathname)) return null;
    return value;
  } catch { return null; }
}

export function publicWorkerFields<T extends { full_name?: string | null; city?: string | null; skills?: string[] | null; short_intro?: string | null; experience?: string | null; photo_url?: string | null }>(row: T): T {
  return { ...row,
    full_name: publicWorkerText(row.full_name) || "Trabajador ListoRD",
    city: publicWorkerText(row.city),
    skills: Array.isArray(row.skills) ? row.skills.map(publicWorkerText).filter(Boolean) : [],
    short_intro: publicWorkerText(row.short_intro),
    experience: publicWorkerText(row.experience),
    photo_url: publicPhotoUrl(row.photo_url),
  };
}
