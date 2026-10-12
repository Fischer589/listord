"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "./env";

let client: SupabaseClient | null = null;
/** One client per browser tab. Server identity always comes from auth.getUser.
 * Tab-scoped storage survives navigation/Checkout, never a shared-device login. */
export function getMarketplaceBrowserClient() {
  if (typeof window === "undefined") return null;
  if (client) return client;
  const config = getPublicEnv();
  if (!config.isConfigured) return null;
  const memory = new Map<string, string>();
  client = createClient(config.env.supabaseUrl, config.env.supabaseAnonKey, {
    auth: {
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
      storageKey: "listord-marketplace-session-v1",
      storage: {
        getItem: key => { try { return sessionStorage.getItem(key); } catch { return memory.get(key) ?? null; } },
        setItem: (key, value) => { memory.set(key, value); try { sessionStorage.setItem(key, value); } catch { /* Memory-only fallback. */ } },
        removeItem: key => { memory.delete(key); try { sessionStorage.removeItem(key); } catch { /* Memory-only fallback. */ } },
      },
    },
  });
  return client;
}
