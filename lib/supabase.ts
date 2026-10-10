import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "./env";

export function getSupabaseClient(timeoutMs?: number) {
  const publicEnv = getPublicEnv();

  if (!publicEnv.isConfigured) {
    return null;
  }

  // One deadline for the entire client operation, including SDK retries.
  // A fresh timeout per fetch would multiply outage latency on every retry.
  const deadline = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;

  return createClient(
    publicEnv.env.supabaseUrl,
    publicEnv.env.supabaseAnonKey,
    {
      ...(deadline ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([deadline, init.signal]) : deadline }) } } : {}),
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}
