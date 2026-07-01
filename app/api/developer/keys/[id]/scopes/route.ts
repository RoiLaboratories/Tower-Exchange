import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser, getClientIp } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * GET /api/developer/keys/[id]/scopes
 * Returns the array of scope IDs currently bound to this API key.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: keyId } = await params;

    // 1. Verify ownership of the key
    const { data: key, error: keyError } = await supabaseAdmin
      .from("api_keys")
      .select("id, user_id")
      .eq("id", keyId)
      .maybeSingle();

    if (keyError || !key) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (key.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden. Ownership mismatch." }, { status: 403 });
    }

    // 2. Fetch scopes
    const { data: scopesData, error: scopesError } = await supabaseAdmin
      .from("api_key_scopes")
      .select("scope_id")
      .eq("api_key_id", keyId);

    if (scopesError) {
      console.error("Fetch key scopes error:", scopesError);
      return NextResponse.json({ error: "Failed to fetch key scopes" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      scopes: (scopesData || []).map((s) => s.scope_id),
    });
  } catch (error) {
    console.error("Get API key scopes API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/developer/keys/[id]/scopes
 * Replaces the entire set of scopes bound to this API key with a new set.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: keyId } = await params;
    const body = await request.json();
    const { scopes } = body as { scopes?: string[] };

    if (!scopes || !Array.isArray(scopes)) {
      return NextResponse.json({ error: "Missing required field: scopes (array)" }, { status: 400 });
    }

    // 1. Verify ownership of the key
    const { data: key, error: keyError } = await supabaseAdmin
      .from("api_keys")
      .select("id, user_id")
      .eq("id", keyId)
      .maybeSingle();

    if (keyError || !key) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (key.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden. Ownership mismatch." }, { status: 403 });
    }

    // 2. Validate scope catalog ids
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

    // 3. Clear existing bindings
    const { error: deleteError } = await supabaseAdmin
      .from("api_key_scopes")
      .delete()
      .eq("api_key_id", keyId);

    if (deleteError) {
      console.error("Clear API key scopes error:", deleteError);
      return NextResponse.json({ error: "Failed to update key scopes" }, { status: 500 });
    }

    // 4. Insert new bindings
    if (scopes.length > 0) {
      const scopeBindings = scopes.map((scopeId) => ({
        api_key_id: keyId,
        scope_id: scopeId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from("api_key_scopes")
        .insert(scopeBindings);

      if (insertError) {
        console.error("Insert key scopes error:", insertError);
        return NextResponse.json({ error: "Failed to save updated key scopes" }, { status: 500 });
      }
    }

    // 5. Log audit trail
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "api_key.scopes.update",
      metadata: { key_id: keyId, scopes },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      message: "Key scopes updated successfully",
      scopes,
    });
  } catch (error) {
    console.error("Update API key scopes API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
