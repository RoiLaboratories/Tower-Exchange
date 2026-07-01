import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDeveloperUser, getClientIp } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

/**
 * GET /api/developer/keys
 * Lists all API keys for the authenticated developer, including their bound scopes.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch keys
    const { data: keys, error: keysError } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, environment, key_prefix, rate_limit, last_used_at, revoked_at, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (keysError || !keys) {
      console.error("Fetch API keys error:", keysError);
      return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
    }

    if (keys.length === 0) {
      return NextResponse.json({ success: true, keys: [] });
    }

    // 2. Fetch scopes for all keys owned by the user
    const keyIds = keys.map((k) => k.id);
    const { data: scopesData, error: scopesError } = await supabaseAdmin
      .from("api_key_scopes")
      .select("api_key_id, scope_id")
      .in("api_key_id", keyIds);

    if (scopesError || !scopesData) {
      console.error("Fetch API key scopes error:", scopesError);
      return NextResponse.json({ error: "Failed to fetch API key scopes" }, { status: 500 });
    }

    // Group scopes by key ID
    const scopesMap = scopesData.reduce((acc, row) => {
      if (!acc[row.api_key_id]) {
        acc[row.api_key_id] = [];
      }
      acc[row.api_key_id].push(row.scope_id);
      return acc;
    }, {} as Record<string, string[]>);

    // Merge scopes into key objects
    const keysWithScopes = keys.map((key) => ({
      ...key,
      scopes: scopesMap[key.id] || [],
    }));

    return NextResponse.json({
      success: true,
      keys: keysWithScopes,
    });
  } catch (error) {
    console.error("List API keys API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/developer/keys
 * Generates a new API key with specific name, environment, and scopes.
 * Returns the raw secret key exactly once.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, environment = "live", scopes = [] } = body as {
      name?: string;
      environment?: "test" | "live";
      scopes?: string[];
    };

    if (!name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }

    if (environment !== "test" && environment !== "live") {
      return NextResponse.json({ error: "Environment must be 'test' or 'live'" }, { status: 400 });
    }

    // Validate that requested scopes are valid scope catalog items
    const { data: validScopesData, error: validScopesError } = await supabaseAdmin
      .from("scopes")
      .select("id");

    if (validScopesError || !validScopesData) {
      return NextResponse.json({ error: "Failed to validate scopes catalog" }, { status: 500 });
    }

    const validScopeIds = validScopesData.map((s) => s.id);
    for (const scope of scopes) {
      if (!validScopeIds.includes(scope)) {
        return NextResponse.json({ error: `Invalid scope: '${scope}'` }, { status: 400 });
      }
    }

    // 1. Generate the raw secret key
    const rawSecret = crypto.randomBytes(24).toString("hex"); // 48 chars hex payload
    const prefix = `twr_${environment}_`;
    const secretKey = `${prefix}${rawSecret}`; // twr_live_abcdef... or twr_test_abcdef...
    const maskedPrefix = `${prefix}${rawSecret.substring(0, 4)}...`;

    // 2. Hash key securely (SHA-256)
    const keyHash = crypto.createHash("sha256").update(secretKey).digest("hex");

    // 3. Insert API Key record
    const { data: apiKey, error: insertError } = await supabaseAdmin
      .from("api_keys")
      .insert({
        user_id: user.id,
        name: name.trim(),
        environment,
        key_prefix: maskedPrefix,
        key_hash: keyHash,
        rate_limit: null, // use default plan rate limits
      })
      .select("id, name, environment, key_prefix, rate_limit, created_at")
      .single();

    if (insertError || !apiKey) {
      console.error("Generate API key insert error:", insertError);
      return NextResponse.json({ error: "Failed to generate API key" }, { status: 500 });
    }

    // 4. Bind selected scopes to the API Key
    if (scopes.length > 0) {
      const scopeBindings = scopes.map((scopeId) => ({
        api_key_id: apiKey.id,
        scope_id: scopeId,
      }));

      const { error: scopesInsertError } = await supabaseAdmin
        .from("api_key_scopes")
        .insert(scopeBindings);

      if (scopesInsertError) {
        console.error("API Key scopes binding insert error:", scopesInsertError);
        // Fallback: delete key and return error
        await supabaseAdmin.from("api_keys").delete().eq("id", apiKey.id);
        return NextResponse.json({ error: "Failed to configure scopes for API key" }, { status: 500 });
      }
    }

    // 5. Log audit trail
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "api_key.create",
      metadata: { key_id: apiKey.id, name: name.trim(), environment },
      ip_address: getClientIp(request),
    });

    // Return the raw secret key along with metadata
    return NextResponse.json({
      success: true,
      apiKey: {
        ...apiKey,
        secretKey, // ONLY RETURNED ONCE
        scopes,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Generate API key API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
