const DEFAULT_COUNTRY_CODE = "1";

export function normalizeWhatsAppNumber(value?: string | null) {
  const rawValue = String(value || "");
  const trimmedValue = rawValue.trim();
  const digits = rawValue.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  if (trimmedValue.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  return `+${digits}`;
}

export function normalizeWhatsAppUrlPhoneNumber(value?: string | null) {
  const digits = String(value || "").replace(/[+\s-]/g, "").replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
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

export function workerContactMessage(fullName?: string | null) {
  const candidate = fullName?.trim().split(/\s+/)[0];
  let firstName = candidate && !candidate.includes("\uFFFD") ? candidate : "";
  try { encodeURIComponent(firstName); } catch { firstName = ""; }
  return `\u00a1Hola${firstName ? `, ${firstName}` : ""}! \uD83D\uDC4B Vi tu perfil en ListoRD y me llam\u00F3 la atenci\u00F3n. Me gustar\u00EDa conversar contigo sobre una oportunidad de trabajo. \u00BFEst\u00E1s disponible para hablar? \uD83D\uDE0A`;
}

export function buildWorkerContactWhatsAppUrl(number?: string | null, fullName?: string | null) {
  const url = buildWhatsAppUrl(number);
  return url ? `${url}?text=${encodeURIComponent(workerContactMessage(fullName))}` : null;
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
