/** Signed, expiring cookie shared by Edge middleware and server guards. */
export const ADMIN_SESSION_SECONDS = 7 * 24 * 60 * 60;

async function signingKey(secret: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function base64url(bytes: Uint8Array) {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), char => char.charCodeAt(0));
}

export async function createAdminSession(secret: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS;
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `v1.${expires}.${nonce}`;
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(secret), new TextEncoder().encode(payload)));
  return `${payload}.${base64url(signature)}`;
}

/** Missing configuration, malformed signatures and expired sessions fail closed. */
export async function isAdminSession(value: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!secret || !value) return false;
  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || !/^\d{10}$/.test(parts[1]) || !/^[A-Za-z0-9_-]{22}$/.test(parts[2]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[3])) return false;
  const expires = Number(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (expires <= now || expires > now + ADMIN_SESSION_SECONDS + 60) return false;
  try {
    const payload = new TextEncoder().encode(parts.slice(0, 3).join('.'));
    return await crypto.subtle.verify('HMAC', await signingKey(secret), decode(parts[3]), payload);
  } catch {
    return false;
  }
}
