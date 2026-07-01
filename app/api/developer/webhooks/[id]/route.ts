import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser, getClientIp } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * GET /api/developer/webhooks/[id]
 * Retrieves details for a specific webhook (excluding secret).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: webhookId } = await params;

    const { data: webhook, error } = await supabaseAdmin
      .from("webhooks")
      .select("id, url, active, created_at, updated_at, user_id")
      .eq("id", webhookId)
      .maybeSingle();

    if (error || !webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    if (webhook.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden. Ownership mismatch." }, { status: 403 });
    }

    const { user_id, ...webhookData } = webhook;

    return NextResponse.json({
      success: true,
      webhook: webhookData,
    });
  } catch (error) {
    console.error("GET webhook details error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/developer/webhooks/[id]
 * Updates webhook url or active status.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: webhookId } = await params;
    const body = await request.json();
    const { url, active } = body as { url?: string; active?: boolean };

    // 1. Verify ownership
    const { data: webhook, error } = await supabaseAdmin
      .from("webhooks")
      .select("id, user_id")
      .eq("id", webhookId)
      .maybeSingle();

    if (error || !webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    if (webhook.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden. Ownership mismatch." }, { status: 403 });
    }

    const updateFields: Record<string, any> = {};
    if (url !== undefined) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json({ error: "Invalid webhook URL format" }, { status: 400 });
      }
      updateFields.url = url;
    }
    if (active !== undefined) {
      updateFields.active = active;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // 2. Perform database update
    const { error: updateError } = await supabaseAdmin
      .from("webhooks")
      .update(updateFields)
      .eq("id", webhookId);

    if (updateError) {
      console.error("PATCH webhook update error:", updateError);
      return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
    }

    // 3. Log audit event
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "webhook.update",
      metadata: { webhook_id: webhookId, updated_fields: Object.keys(updateFields) },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      message: "Webhook updated successfully",
    });
  } catch (error) {
    console.error("PATCH webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/developer/webhooks/[id]
 * Deletes a registered webhook.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: webhookId } = await params;

    // 1. Verify ownership
    const { data: webhook, error } = await supabaseAdmin
      .from("webhooks")
      .select("id, user_id")
      .eq("id", webhookId)
      .maybeSingle();

    if (error || !webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    if (webhook.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden. Ownership mismatch." }, { status: 403 });
    }

    // 2. Delete webhook
    const { error: deleteError = null } = await supabaseAdmin
      .from("webhooks")
      .delete()
      .eq("id", webhookId);

    if (deleteError) {
      console.error("Delete webhook error:", deleteError);
      return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
    }

    // 3. Log audit event
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "webhook.delete",
      metadata: { webhook_id: webhookId },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      message: "Webhook deleted successfully",
    });
  } catch (error) {
    console.error("DELETE webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
