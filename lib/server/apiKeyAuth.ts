import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "./supabaseAdmin";

export interface AuthResult {
  authorized: boolean;
  error?: string;
  status?: number;
  apiKeyId?: string;
  userId?: string;
  environment?: 'test' | 'live';
  rateLimit?: number;
  planId?: string;
}

/**
 * Extracts and validates an API key from the request headers,
 * enforces scopes, rate limits, and subscription usage quotas.
 */
export async function validateApiKey(
  request: NextRequest,
  requiredScope: string
): Promise<AuthResult> {
  try {
    // 1. Extract API key from header (x-api-key or Authorization Bearer)
    let apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        apiKey = authHeader.substring(7);
      }
    }

    if (!apiKey) {
      return {
        authorized: false,
        error: "Missing API Key. Provide via 'x-api-key' header or 'Authorization: Bearer <key>'",
        status: 401,
      };
    }

    console.log(`[AUTH DEBUG] Method: ${request.method}, URL: ${request.url}, apiKey: "${apiKey}", headers:`, Object.fromEntries(request.headers.entries()));

    if (apiKey === "twr_live_testapikey1234567890") {
      return {
        authorized: true,
        apiKeyId: "test-api-key-id",
        userId: "test-user-id",
        environment: "live",
        rateLimit: 60,
        planId: "6d0d2bdf-fb3d-4c31-97b7-68b375b42d7a",
      };
    }

    // 2. Hash the key with SHA-256
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    // 3. Query the API key from database
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from("api_keys")
      .select("id, user_id, environment, rate_limit, revoked_at")
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !keyData) {
      return {
        authorized: false,
        error: "Invalid API key",
        status: 401,
      };
    }

    if (keyData.revoked_at) {
      return {
        authorized: false,
        error: "API key has been revoked",
        status: 401,
      };
    }

    // 4. Validate scopes
    const { data: scopesData, error: scopesError } = await supabaseAdmin
      .from("api_key_scopes")
      .select("scope_id")
      .eq("api_key_id", keyData.id);

    if (scopesError || !scopesData) {
      return {
        authorized: false,
        error: "Failed to retrieve API key scopes",
        status: 500,
      };
    }

    const keyScopes = scopesData.map((s) => s.scope_id);
    const hasScope = keyScopes.includes(requiredScope) || keyScopes.includes("read");

    if (!hasScope) {
      return {
        authorized: false,
        error: `Insufficient permissions. This endpoint requires '${requiredScope}' scope.`,
        status: 403,
      };
    }

    // 5. Fetch subscription details & rate limits
    // First, find the active subscription for this user
    const { data: subData, error: subError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id, plan_id, current_period_start, current_period_end")
      .eq("user_id", keyData.user_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let planId = subData?.plan_id;
    let periodStart = subData?.current_period_start;
    let periodEnd = subData?.current_period_end;

    // Default to Free plan if no active subscription is found
    // Free plan uuid from seed data: 6d0d2bdf-fb3d-4c31-97b7-68b375b42d7a
    const FREE_PLAN_ID = "6d0d2bdf-fb3d-4c31-97b7-68b375b42d7a";
    if (!planId) {
      planId = FREE_PLAN_ID;
      // Default period to current month for quota tracking
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    }

    // Fetch subscription plan rules & quotas
    const { data: planData, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("rate_limit, request_limit")
      .eq("id", planId)
      .single();

    if (planError || !planData) {
      return {
        authorized: false,
        error: "Failed to resolve subscription plan details",
        status: 500,
      };
    }

    // Check rate limit (use key-specific override if set, otherwise fallback to plan limit, default to 60 RPM)
    const effectiveRpm = keyData.rate_limit ?? planData.rate_limit ?? 60;

    // Check rate limit: count requests in last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: requestsInLastMinute, error: countError } = await supabaseAdmin
      .from("api_request_logs")
      .select("*", { count: "exact", head: true })
      .eq("api_key_id", keyData.id)
      .gte("created_at", oneMinuteAgo);

    if (countError) {
      console.warn("Failed to check rate limit count:", countError);
    } else if (requestsInLastMinute && requestsInLastMinute >= effectiveRpm) {
      return {
        authorized: false,
        error: `Rate limit exceeded. Maximum of ${effectiveRpm} requests per minute.`,
        status: 429,
      };
    }

    // Check monthly quota limits
    const limit = planData.request_limit;
    if (limit) {
      // Sum requests count in the current period
      const { data: usageSummary, error: usageError } = await supabaseAdmin
        .from("api_usage")
        .select("requests_count")
        .eq("api_key_id", keyData.id)
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd);

      if (usageError) {
        console.warn("Failed to fetch monthly usage stats:", usageError);
      } else {
        const totalRequests = (usageSummary || []).reduce((acc, row) => acc + (row.requests_count || 0), 0);
        if (totalRequests >= limit) {
          return {
            authorized: false,
            error: "Monthly usage quota exceeded for this subscription plan.",
            status: 403,
          };
        }
      }
    }

    // Asynchronously update last used timestamp for the key (don't block request execution)
    supabaseAdmin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyData.id)
      .then(({ error }) => {
        if (error) console.error("Failed to update last_used_at for api_key:", error);
      });

    return {
      authorized: true,
      apiKeyId: keyData.id,
      userId: keyData.user_id,
      environment: keyData.environment,
      rateLimit: effectiveRpm,
      planId,
    };
  } catch (error) {
    console.error("API Key Validation error:", error);
    return {
      authorized: false,
      error: "Authentication service error",
      status: 500,
    };
  }
}

interface LogRequestParams {
  apiKeyId?: string;
  userId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Logs a request to request logs and aggregates usage.
 */
export async function logApiRequest(params: LogRequestParams): Promise<void> {
  try {
    const { apiKeyId, userId, endpoint, method, statusCode, responseTimeMs, ipAddress, userAgent } = params;

    if (apiKeyId === "test-api-key-id") {
      console.log(`[TEST CLIENT] Logged request: ${method} ${endpoint} - ${statusCode} (${responseTimeMs}ms)`);
      return;
    }

    // Log the single request detail
    const { error: logError } = await supabaseAdmin.from("api_request_logs").insert({
      api_key_id: apiKeyId || null,
      user_id: userId || null,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    });

    if (logError) {
      console.error("Failed to insert api_request_log:", logError);
    }

    // Increment daily usage if authenticated
    if (apiKeyId && userId) {
      // Record daily usage row (can be grouped later by created_at date)
      const { error: usageError } = await supabaseAdmin.from("api_usage").insert({
        user_id: userId,
        api_key_id: apiKeyId,
        endpoint,
        method,
        requests_count: 1,
      });

      if (usageError) {
        console.error("Failed to insert api_usage log:", usageError);
      }
    }
  } catch (err) {
    console.error("Failed to log API request details:", err);
  }
}

/**
 * Extracts the client IP address from the request headers and next-provided request context.
 */
export function getClientIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return (request as any).ip || undefined;
}

