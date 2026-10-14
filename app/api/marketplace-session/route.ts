import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/http-json";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

const lifetimeMs = 30 * 24 * 60 * 60 * 1000;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
type SavedSession = { userId: string; accessToken: string; refreshToken: string; accessExpiresAt: number; until: number };

function cookieName(request: Request) {
  return new URL(request.url).protocol === "https:"
    ? "__Host-listord-marketplace-session"
    : "listord-marketplace-session-dev";
}

function encryptionKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return secret && secret.length >= 32
    ? createHash("sha256").update("listord-marketplace-session-v1\0").update(secret).digest()
    : null;
}

function seal(session: SavedSession, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

function unseal(value: string, key: Buffer): SavedSession | null {
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length < 29 || bytes.length > 3800) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const state = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")) as SavedSession;
    if (!state || typeof state.userId !== "string" || typeof state.accessToken !== "string" ||
        typeof state.refreshToken !== "string" || !Number.isFinite(state.accessExpiresAt) ||
        !Number.isFinite(state.until)) return null;
    return state;
  } catch { return null; }
}

function readCookie(request: Request, key: Buffer) {
  const name = `${cookieName(request)}=`;
  const value = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(name))?.slice(name.length);
  return value ? unseal(value, key) : null;
}

function setCookie(response: NextResponse, request: Request, session: SavedSession, key: Buffer) {
  const value = seal(session, key);
  if (value.length > 3800) return false;
  response.cookies.set(cookieName(request), value, {
    httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/",
    maxAge: Math.max(1, Math.floor((session.until - Date.now()) / 1000)),
  });
  return true;
}

function clearCookie(response: NextResponse, request: Request) {
  response.cookies.set(cookieName(request), "", {
    httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 0,
  });
  return response;
}

function verified(user: { id: string; is_anonymous?: boolean; email_confirmed_at?: string | null; phone_confirmed_at?: string | null } | null) {
  return !!user && !user.is_anonymous && !!(user.email_confirmed_at || user.phone_confirmed_at);
}

export async function POST(request: Request) {
  const key = encryptionKey();
  if (!key) return NextResponse.json({ error: "Sesión no disponible." }, { status: 503, headers });
  let input: unknown;
  try { input = await readJsonBody(request, 6000); }
  catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400, headers }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400, headers });
  const body = input as Record<string, unknown>;
  const accessToken = body.access_token;
  const refreshToken = body.refresh_token;
  // Supabase Auth also issues 12-character legacy refresh tokens. Their format
  // is validated here; the access token and account are verified with Auth below.
  const refreshTokenFormatValid = typeof refreshToken === "string" &&
    (/^[a-z0-9]{12}$/.test(refreshToken) || /^[A-Za-z0-9._-]{20,1024}$/.test(refreshToken));
  if (typeof accessToken !== "string" || !/^[A-Za-z0-9._-]{20,4096}$/.test(accessToken) ||
      !refreshTokenFormatValid) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 400, headers });
  }
  const auth = getSupabaseClient(8000);
  if (!auth) return NextResponse.json({ error: "Sesión no disponible." }, { status: 503, headers });
  const { data, error } = await auth.auth.getUser(accessToken);
  if (error || !verified(data.user)) return NextResponse.json({ error: "Sesión inválida." }, { status: 401, headers });
  const now = Date.now();
  const requestedExpiry = typeof body.expires_at === "number" && Number.isFinite(body.expires_at)
    ? body.expires_at * 1000 : now + 60_000;
  const session: SavedSession = {
    userId: data.user!.id, accessToken, refreshToken,
    accessExpiresAt: Math.min(Math.max(requestedExpiry, now), now + 24 * 60 * 60 * 1000),
    until: now + lifetimeMs,
  };
  const response = new NextResponse(null, { status: 204, headers });
  return setCookie(response, request, session, key) ? response
    : NextResponse.json({ error: "Sesión demasiado grande." }, { status: 413, headers });
}

export async function GET(request: Request) {
  const key = encryptionKey();
  if (!key) return NextResponse.json({ error: "Sesión no disponible." }, { status: 503, headers });
  const saved = readCookie(request, key);
  if (!saved) return NextResponse.json({ error: "Sin sesión." }, { status: 401, headers });
  const invalid = () => clearCookie(NextResponse.json({ error: "Sesión vencida." }, { status: 401, headers }), request);
  if (saved.until <= Date.now()) return invalid();
  const auth = getSupabaseClient(8000);
  if (!auth) return NextResponse.json({ error: "Sesión no disponible." }, { status: 503, headers });
  let accessToken = saved.accessToken;
  let refreshToken = saved.refreshToken;
  let accessExpiresAt = saved.accessExpiresAt;
  if (accessExpiresAt <= Date.now() + 60_000) {
    const { data, error } = await auth.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !verified(data.user) || data.user!.id !== saved.userId) return invalid();
    accessToken = data.session.access_token;
    refreshToken = data.session.refresh_token;
    accessExpiresAt = (data.session.expires_at ?? Math.floor(Date.now() / 1000) + 60) * 1000;
  } else {
    const { data, error } = await auth.auth.getUser(accessToken);
    if (error || !verified(data.user) || data.user!.id !== saved.userId) return invalid();
  }
  const response = NextResponse.json({ access_token: accessToken, refresh_token: refreshToken }, { headers });
  return setCookie(response, request, { ...saved, accessToken, refreshToken, accessExpiresAt }, key) ? response
    : NextResponse.json({ error: "Sesión no disponible." }, { status: 503, headers });
}

export async function DELETE(request: Request) {
  try { await readJsonBody(request, 2); }
  catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400, headers }); }
  return clearCookie(new NextResponse(null, { status: 204, headers }), request);
}
