"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "./env";

let client: SupabaseClient | null = null;
const sessionKey = "listord-marketplace-session-v1";
const checkoutBridgeCookie = "listord_workspace_checkout_bridge_v1";
const checkoutBridgeLifetimeMs = 50 * 60_000;

function readCheckoutBridge() {
  const value = document.cookie.split("; ").find(part => part.startsWith(`${checkoutBridgeCookie}=`))?.slice(checkoutBridgeCookie.length + 1);
  if (!value) return null;
  try { return JSON.parse(decodeURIComponent(value)) as {
    expiresAt?: number; sessionId?: string | null; session?: { access_token?: string; refresh_token?: string };
  }; } catch { return null; }
}

function writeCheckoutBridge(bridge: object) {
  const value = encodeURIComponent(JSON.stringify(bridge));
  if (value.length > 3500) return false;
  document.cookie = `${checkoutBridgeCookie}=${value}; Max-Age=3000; Path=/empleadores/mi-cuenta; SameSite=Strict${window.location.protocol === "https:" ? "; Secure" : ""}`;
  return document.cookie.includes(`${checkoutBridgeCookie}=${value}`);
}

function removeCheckoutBridge() {
  document.cookie = `${checkoutBridgeCookie}=; Max-Age=0; Path=/empleadores/mi-cuenta; SameSite=Strict${window.location.protocol === "https:" ? "; Secure" : ""}`;
}

function recoverCheckoutSession(key: string) {
  if (key !== sessionKey || window.location.pathname !== "/empleadores/mi-cuenta" ||
      new URLSearchParams(window.location.search).get("checkout") !== "return") return null;
  try {
    const bridge = readCheckoutBridge();
    if (!bridge) return null;
    if (typeof bridge.expiresAt !== "number" || bridge.expiresAt <= Date.now()) {
      removeCheckoutBridge();
      return null;
    }
    if (!bridge.sessionId || bridge.sessionId !== new URLSearchParams(window.location.search).get("session_id") ||
        typeof bridge.session?.access_token !== "string" || typeof bridge.session.refresh_token !== "string") return null;
    removeCheckoutBridge();
    const saved = JSON.stringify(bridge.session);
    sessionStorage.setItem(key, saved);
    return saved;
  } catch { return null; }
}

/** Resume authentication after Checkout opens a different tab or browser context.
 * The bridge is short-lived, consumed once, and never represents payment. */
export async function prepareWorkspaceCheckoutReturn() {
  const browserClient = getMarketplaceBrowserClient();
  if (!browserClient) return false;
  const { data, error } = await browserClient.auth.getSession();
  if (error || !data.session) return false;
  try {
    if (!sessionStorage.getItem(sessionKey)) return false;
    return writeCheckoutBridge({
      expiresAt: Date.now() + checkoutBridgeLifetimeMs, sessionId: null, session: data.session,
    });
  } catch { return false; }
}

export function bindWorkspaceCheckoutReturn(sessionId: string) {
  if (!/^cs_(?:test|live)_[A-Za-z0-9_]+$/.test(sessionId)) return false;
  try {
    const bridge = readCheckoutBridge();
    if (!bridge) return false;
    if (typeof bridge.expiresAt !== "number" || bridge.expiresAt <= Date.now() ||
        typeof bridge.session?.access_token !== "string" || typeof bridge.session.refresh_token !== "string") return false;
    return writeCheckoutBridge({ ...bridge, sessionId });
  } catch { return false; }
}

export function clearWorkspaceCheckoutReturn(sessionId?: string) {
  try {
    if (sessionId) {
      if (readCheckoutBridge()?.sessionId !== sessionId) return;
    }
    removeCheckoutBridge();
  } catch { /* Storage may be disabled. */ }
}

/** One client per browser tab. Server identity always comes from auth.getUser.
 * Normal storage remains tab-scoped; only a pending Checkout has a brief bridge. */
export function getMarketplaceBrowserClient() {
  if (typeof window === "undefined") return null;
  if (client) return client;
  const config = getPublicEnv();
  if (!config.isConfigured) return null;
  const memory = new Map<string, string>();
  client = createClient(config.env.supabaseUrl, config.env.supabaseAnonKey, {
    auth: {
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
      storageKey: sessionKey,
      storage: {
        getItem: key => { try { return sessionStorage.getItem(key) ?? recoverCheckoutSession(key); } catch { return memory.get(key) ?? recoverCheckoutSession(key); } },
        setItem: (key, value) => { memory.set(key, value); try { sessionStorage.setItem(key, value); } catch { /* Memory-only fallback. */ } },
        removeItem: key => { memory.delete(key); try { sessionStorage.removeItem(key); } catch { /* Memory-only fallback. */ } },
      },
    },
  });
  return client;
}
