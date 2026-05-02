const DEFAULT_COUNTRY_CODE = "1";

export function normalizeWhatsAppUrlPhoneNumber(value?: string | null) {
  const digits = String(value || "").replace(/[+\s-]/g, "").replace(/\D/g, "");

  if (digits.length < 10) {
    return null;
  }

  if (digits.length === 10) {
    return `${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  return digits;
}

export function buildWhatsAppUrl(value?: string | null) {
  const phoneNumber = normalizeWhatsAppUrlPhoneNumber(value);

  if (!phoneNumber) {
    return null;
  }

  return `https://wa.me/${phoneNumber}`;
}

export function isValidWhatsAppUrl(value?: string | null) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "wa.me" &&
      /^\/\d+$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
