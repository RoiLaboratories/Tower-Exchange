import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { hashPassword } from "@/lib/server/password";
import { getClientIp } from "@/lib/server/developerAuth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body as { token?: string; password?: string };

    if (!token || !password) {
      return NextResponse.json(
        { error: "Missing required fields: token, password" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // 1. Find user by reset token
    const { data: user, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, reset_token_expires_at")
      .eq("reset_token", token)
      .maybeSingle();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired password reset token" },
        { status: 400 }
      );
    }

    // 2. Validate token expiration
    if (!user.reset_token_expires_at) {
      return NextResponse.json(
        { error: "Invalid password reset token" },
        { status: 400 }
      );
    }

    const expiry = new Date(user.reset_token_expires_at).getTime();
    if (Date.now() > expiry) {
      return NextResponse.json(
        { error: "Password reset token has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // 3. Hash new password & update database
    const newHash = hashPassword(password);

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        password_hash: newHash,
        reset_token: null,
        reset_token_expires_at: null,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Reset password update error:", updateError);
      return NextResponse.json(
        { error: "Failed to reset password" },
        { status: 500 }
      );
    }

    // Log the audit event
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "auth.reset_password",
      metadata: { },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      message: "Your password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
