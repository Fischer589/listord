type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type PublicEnvResult =
  | { isConfigured: true; env: PublicEnv }
  | { isConfigured: false; reason: string };

export type PublicEnvDiagnostics = {
  hasNextPublicSupabaseUrl: boolean;
  hasNextPublicSupabaseAnonKey: boolean;
  supabaseUrlHost: string;
};

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

  return {
    isConfigured: true,
    env: {
      supabaseUrl,
      supabaseAnonKey
    }
  };
}

export function getPublicEnvDiagnostics(): PublicEnvDiagnostics {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return {
    hasNextPublicSupabaseUrl: Boolean(supabaseUrl),
    hasNextPublicSupabaseAnonKey: Boolean(supabaseAnonKey),
    supabaseUrlHost: getSupabaseUrlHost(supabaseUrl)
  };
}

function getSupabaseUrlHost(supabaseUrl: string | undefined) {
  if (!supabaseUrl) {
    return "not configured";
  }

  try {
    return new URL(supabaseUrl).host;
  } catch {
    return "invalid URL";
  }
}
