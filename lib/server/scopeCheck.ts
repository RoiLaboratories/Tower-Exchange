import { supabaseAdmin } from "./devApiSupabase";

export interface ScopeCheckResult {
  allowed: boolean;
  grantedScopes: string[];
  status?: number;
  error?: string;
}

export async function checkApiKeyScope(
  apiKeyId: string,
  requiredScope: string | null
): Promise<ScopeCheckResult> {
  try {
    const { data: dbScopes, error } = await supabaseAdmin
      .from("api_key_scopes")
      .select("scope_id")
      .eq("api_key_id", apiKeyId);

    if (error) {
      console.error("Database error checking API key scopes:", error.message);
      return {
        allowed: false,
        grantedScopes: [],
        status: 500,
        error: "Database error checking API key scopes",
      };
    }

    const grantedScopes = (dbScopes ?? []).map((s) => s.scope_id);

    if (!requiredScope) {
      // Endpoint is open to any valid API key
      return { allowed: true, grantedScopes };
    }

    if (grantedScopes.includes(requiredScope)) {
      return { allowed: true, grantedScopes };
    }

    return {
      allowed: false,
      status: 403,
      error: `Scope '${requiredScope}' is required for this endpoint. Granted scopes: ${
        grantedScopes.length > 0 ? grantedScopes.join(", ") : "none"
      }.`,
      grantedScopes,
    };
  } catch (err: any) {
    console.error("Unexpected error in checkApiKeyScope:", err);
    return {
      allowed: false,
      grantedScopes: [],
      status: 500,
      error: "Internal error checking API key scope",
    };
  }
}
