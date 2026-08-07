import crypto from "crypto";
import { supabaseAdmin } from "./devApiSupabase";

export interface AuthenticatedApiKey {
  id: string;
  userId: string;
  name: string;
  rateLimit: number | null;
  environment: "test" | "live";
  keyType: "secret" | "publishable";
}

export interface AuthResult {
  authenticated: boolean;
  key?: AuthenticatedApiKey;
  error?: string;
  status?: number;
}

export function hashApiKey(secretKey: string): string {
  return crypto.createHash("sha256").update(secretKey.trim()).digest("hex");
}

export function extractApiKey(request: Request): string | null {
  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader) {
    const parts = authHeader.trim().split(" ");
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      return parts[1].trim();
    }
    if (parts.length === 1 && !/^bearer$/i.test(parts[0])) {
      return parts[0].trim();
    }
  }

  const xApiKey =
    request.headers.get("x-api-key") || request.headers.get("X-API-Key");
  if (xApiKey && xApiKey.trim()) {
    return xApiKey.trim();
  }

  return null;
}

export async function validateApiKey(request: Request): Promise<AuthResult> {
  const rawKey = extractApiKey(request);

  if (!rawKey) {
    return {
      authenticated: false,
      status: 401,
      error:
        "API key is required. Provide via 'Authorization: Bearer <key>' or 'x-api-key' header.",
    };
  }

  const keyHash = hashApiKey(rawKey);

  try {
    const { data: keyRow, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, user_id, name, rate_limit, revoked_at, environment, key_type")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (error) {
      console.error("Database error during API key lookup:", error.message);
      return {
        authenticated: false,
        status: 401,
        error: "Invalid API key",
      };
    }

    if (!keyRow) {
      return {
        authenticated: false,
        status: 401,
        error: "Invalid API key",
      };
    }

    if (keyRow.revoked_at !== null && keyRow.revoked_at !== undefined) {
      return {
        authenticated: false,
        status: 401,
        error: "API key has been revoked",
      };
    }

    return {
      authenticated: true,
      key: {
        id: keyRow.id,
        userId: keyRow.user_id,
        name: keyRow.name,
        rateLimit: keyRow.rate_limit,
        environment: keyRow.environment,
        keyType: keyRow.key_type,
      },
    };
  } catch (err: any) {
    console.error("Unexpected error in validateApiKey:", err);
    return {
      authenticated: false,
      status: 401,
      error: "Invalid API key",
    };
  }
}
