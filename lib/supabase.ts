import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "./env";

export function getSupabaseClient() {
  const publicEnv = getPublicEnv();

  if (!publicEnv.isConfigured) {
    return null;
  }

  return createClient(
    publicEnv.env.supabaseUrl,
    publicEnv.env.supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}
