import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "./env";

export function getSupabaseAdminClient() {
  const publicEnv = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!publicEnv.isConfigured || !serviceRoleKey) {
    return null;
  }

  return createClient(publicEnv.env.supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
