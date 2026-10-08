/** Shared by Edge middleware and server guards. Missing configuration fails closed. */
export function isAdminSession(value: string | undefined, secret: string | undefined): boolean {
  return Boolean(secret && value && value === secret);
}
