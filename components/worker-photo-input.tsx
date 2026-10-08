"use client";

import { MAX_PHOTO_BYTES } from "@/lib/photo-policy";

/** Reject oversized files before sending a server-action request. */
export function WorkerPhotoInput({ className }: { className: string }) {
  return <input
    className={className}
    name="profile_photo"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    onChange={(event) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      input.setCustomValidity(file && file.size > MAX_PHOTO_BYTES
        ? "La foto supera 4 MB. Elige una foto más pequeña."
        : "");
      if (!input.validity.valid) input.reportValidity();
    }}
  />;
}
