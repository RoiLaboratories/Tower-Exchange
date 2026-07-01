import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDeveloperUser, getClientIp } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

/**
 * GET /api/developer/webhooks
 * Lists all registered webhooks for the developer. Never returns secret keys.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: webhooks, error } = await supabaseAdmin
      .from("webhooks")
      .select("id, url, active, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !webhooks) {
      console.error("Fetch webhooks error:", error);
      return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      webhooks,
    });
  } catch (error) {
    console.error("GET webhooks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/developer/webhooks
 * Creates/Registers a new webhook URL.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url, active = true } = body as { url?: string; active?: boolean };

    if (!url) {
      return NextResponse.json({ error: "Missing required field: url" }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid webhook URL format" }, { status: 400 });
    }

    // Generate a secure webhook signing secret (e.g. whsec_...)
    const webhookSecret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

    const { data: newWebhook, error: insertError } = await supabaseAdmin
      .from("webhooks")
      .insert({
        user_id: user.id,
        url,
        secret: webhookSecret,
        active,
      })
      .select("id, url, active, created_at")
      .single();

    if (insertError || !newWebhook) {
      console.error("Insert webhook error:", insertError);
      return NextResponse.json({ error: "Failed to register webhook" }, { status: 500 });
    }

    // Log the audit event
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "webhook.create",
      metadata: { webhook_id: newWebhook.id, url },
      ip_address: getClientIp(request),
    });

    // Note: To adhere to strict security instructions ("Never return key_hash, password_hash, otp_code, or secret (webhooks) fields in any API response, ever."),
    // the secret field is omitted from the response.
    return NextResponse.json({
      success: true,
      webhook: newWebhook,
    }, { status: 201 });
  } catch (error) {
    console.error("POST webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
