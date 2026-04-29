import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdminClient() {
  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  )?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("Supabase admin client is missing required server config.");
    return null;
  }

  try {
    const url = new URL(supabaseUrl);

    if (url.protocol !== "https:") {
      console.warn("Supabase admin client URL must use https.");
      return null;
    }

    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  } catch {
    console.warn("Supabase admin client has invalid server config.");
    return null;
  }
}
