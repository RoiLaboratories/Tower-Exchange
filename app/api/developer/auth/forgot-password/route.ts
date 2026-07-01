import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getClientIp } from "@/lib/server/developerAuth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email) {
      return NextResponse.json(
        { error: "Missing required field: email" },
        { status: 400 }
      );
    }

    const emailTrimmed = email.trim().toLowerCase();

    // 1. Fetch user profile
    const { data: user, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, email_verified")
      .eq("email", emailTrimmed)
      .maybeSingle();

    // Return a generic success message even if the user wasn't found
    // to prevent email enumeration attacks.
    const genericSuccessResponse = NextResponse.json({
      success: true,
      message: "If that email address is registered, a password reset link will be sent shortly.",
    });

    if (fetchError || !user) {
      return genericSuccessResponse;
    }

    // 2. Generate random reset token & expiry (1 hour)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        reset_token: resetToken,
        reset_token_expires_at: resetTokenExpiresAt,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Forgot password update error:", updateError);
      return NextResponse.json(
        { error: "Failed to process password reset request" },
        { status: 500 }
      );
    }

    // Log the audit event
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "auth.forgot_password",
      metadata: { email: emailTrimmed },
      ip_address: getClientIp(request),
    });

    // NOTE: Print password reset link to server log
    const resetUrl = `${request.nextUrl.origin}/developer/reset-password?token=${resetToken}`;
    console.log(`[STUB EMAIL] Password reset URL for ${emailTrimmed}: ${resetUrl}`);

    return genericSuccessResponse;
  } catch (error) {
    console.error("Forgot password API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
