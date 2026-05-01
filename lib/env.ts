type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type PublicEnvResult =
  | { isConfigured: true; env: PublicEnv }
  | { isConfigured: false; reason: string };

export function getPublicEnv(): PublicEnvResult {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      isConfigured: false,
      reason:
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY."
    };
  }

  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:") {
      return {
        isConfigured: false,
        reason: "NEXT_PUBLIC_SUPABASE_URL debe usar https."
      };
    }
  } catch {
    return {
      isConfigured: false,
      reason: "NEXT_PUBLIC_SUPABASE_URL no es una URL valida."
    };
  }

  if (looksLikeServiceRoleKey(supabaseAnonKey)) {
    return {
      isConfigured: false,
      reason:
        "NEXT_PUBLIC_SUPABASE_ANON_KEY no puede ser una service role key."
    };
  }

  return {
    isConfigured: true,
    env: {
      supabaseUrl,
      supabaseAnonKey
    }
  };
}

function looksLikeServiceRoleKey(key: string) {
  const parts = key.split(".");
  if (parts.length < 2) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64")
        .toString("utf8")
    ) as { role?: string };

    return payload.role === "service_role";
  } catch {
    return false;
  }
}
