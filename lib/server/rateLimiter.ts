import { supabaseAdmin } from "./devApiSupabase";

export interface RateLimitDecision {
  allowed: boolean;
  scope: string | null;
  limit: number | null;
  remaining: number | null;
  retryAfterSeconds: number | null;
  reason: string | null;
  planName: string | null;
}

export async function enforceRateLimit(params: {
  userId: string;
  apiKeyId: string;
  keyRateLimit: number | null;
  computeUnits?: number;
}): Promise<RateLimitDecision> {
  const { userId, apiKeyId, keyRateLimit, computeUnits = 1 } = params;

  try {
    const { data, error } = await supabaseAdmin.rpc("enforce_rate_limits", {
      p_user_id: userId,
      p_api_key_id: apiKeyId,
      p_key_rpm: keyRateLimit,
      p_compute_units: computeUnits,
    });

    if (error || !data) {
      console.error("enforce_rate_limits RPC failed, failing open:", error?.message);
      return {
        allowed: true,
        scope: null,
        limit: null,
        remaining: null,
        retryAfterSeconds: null,
        reason: null,
        planName: null,
      };
    }

    const raw = data as Record<string, unknown>;
    const toNum = (v: unknown): number | null =>
      v === null || v === undefined ? null : Number(v);

    return {
      allowed: Boolean(raw.allowed),
      scope: (raw.scope as string | null) ?? null,
      limit: toNum(raw.limit),
      remaining: toNum(raw.remaining),
      retryAfterSeconds: toNum(raw.retryAfterSeconds),
      reason: (raw.reason as string | null) ?? null,
      planName: (raw.planName as string | null) ?? null,
    };
  } catch (err: any) {
    console.error("Unexpected error in enforceRateLimit:", err);
    return {
      allowed: true,
      scope: null,
      limit: null,
      remaining: null,
      retryAfterSeconds: null,
      reason: null,
      planName: null,
    };
  }
}

export function buildRateLimitHeaders(
  decision: RateLimitDecision
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (decision.limit !== null && decision.limit !== undefined) {
    headers["X-RateLimit-Limit"] = String(decision.limit);
  }
  if (decision.remaining !== null && decision.remaining !== undefined) {
    headers["X-RateLimit-Remaining"] = String(decision.remaining);
  }
  if (decision.retryAfterSeconds !== null && decision.retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(decision.retryAfterSeconds);
  }
  return headers;
}
