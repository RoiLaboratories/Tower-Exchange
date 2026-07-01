import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser, getClientIp } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * GET /api/developer/keys/[id]
 * Retrieves details for a specific API key if owned by the developer.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: keyId } = await params;

    // 1. Fetch key and verify ownership
    const { data: key, error: keyError } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, environment, key_prefix, rate_limit, last_used_at, revoked_at, created_at, updated_at, user_id")
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
      console.error("Fetch API key scopes error:", scopesError);
      return NextResponse.json({ error: "Failed to fetch key scopes" }, { status: 500 });
    }

    // Remove user_id from returned object for security
    const { user_id, ...keyData } = key;

    return NextResponse.json({
      success: true,
      key: {
        ...keyData,
        scopes: (scopesData || []).map((s) => s.scope_id),
      },
    });
  } catch (error) {
    console.error("Get API key details API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/developer/keys/[id]
 * Renames an API key or updates its scope bindings.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: keyId } = await params;
    const body = await request.json();
    const { name, scopes } = body as { name?: string; scopes?: string[] };

    // 1. Verify ownership
    const { data: key, error: keyError } = await supabaseAdmin
      .from("api_keys")
      .select("id, user_id, environment")
      .eq("id", keyId)
      .maybeSingle();

    if (keyError || !key) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (key.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden. Ownership mismatch." }, { status: 403 });
    }

    const updateFields: Record<string, any> = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      updateFields.name = name.trim();
    }

    // 2. Perform metadata update if necessary
    if (Object.keys(updateFields).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("api_keys")
        .update(updateFields)
        .eq("id", keyId);

      if (updateError) {
        console.error("API key PATCH update error:", updateError);
        return NextResponse.json({ error: "Failed to update API key details" }, { status: 500 });
      }
    }

    // 3. Update scope bindings if provided
    if (scopes !== undefined) {
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

      // Delete existing scope bindings
      const { error: deleteScopesError } = await supabaseAdmin
        .from("api_key_scopes")
        .delete()
        .eq("api_key_id", keyId);

      if (deleteScopesError) {
        console.error("Delete existing API key scopes error:", deleteScopesError);
        return NextResponse.json({ error: "Failed to update key scopes" }, { status: 500 });
      }

      // Insert new scope bindings
      if (scopes.length > 0) {
        const scopeBindings = scopes.map((scopeId) => ({
          api_key_id: keyId,
          scope_id: scopeId,
        }));

        const { error: scopesInsertError } = await supabaseAdmin
          .from("api_key_scopes")
          .insert(scopeBindings);

        if (scopesInsertError) {
          console.error("API Key scopes binding insert error:", scopesInsertError);
          return NextResponse.json({ error: "Failed to save updated key scopes" }, { status: 500 });
        }
      }
    }

    // 4. Log audit log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "api_key.update",
      metadata: { key_id: keyId, name, updated_scopes: scopes !== undefined },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      message: "API key updated successfully",
    });
  } catch (error) {
    console.error("Update API key API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/developer/keys/[id]
 * Revokes an API key by setting revoked_at, keeping the record for metrics FK integrity.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: keyId } = await params;

    // 1. Verify ownership
    const { data: key, error: keyError } = await supabaseAdmin
      .from("api_keys")
      .select("id, user_id, revoked_at")
      .eq("id", keyId)
      .maybeSingle();

    if (keyError || !key) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (key.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden. Ownership mismatch." }, { status: 403 });
    }

    if (key.revoked_at) {
      return NextResponse.json({ error: "API key is already revoked" }, { status: 400 });
    }

    // 2. Set revoked_at to current timestamp (do NOT delete row)
    const { error: revokeError } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", keyId);

    if (revokeError) {
      console.error("Revoke API key error:", revokeError);
      return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
    }

    // 3. Log audit event
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "api_key.revoke",
      metadata: { key_id: keyId },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (error) {
    console.error("Revoke API key API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
