import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getClientIp } from "@/lib/server/developerAuth";

const MAX_OTP_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body as { email?: string; otp?: string };

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Missing required fields: email, otp" },
        { status: 400 }
      );
    }

    const emailTrimmed = email.trim().toLowerCase();

    // 1. Fetch user status
    const { data: user, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, otp_code, otp_expires_at, otp_attempts, email_verified")
      .eq("email", emailTrimmed)
      .maybeSingle();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: "User account not found" },
        { status: 404 }
      );
    }

    if (user.email_verified) {
      return NextResponse.json(
        { error: "Email is already verified" },
        { status: 400 }
      );
    }

    if (!user.otp_code || !user.otp_expires_at) {
      return NextResponse.json(
        { error: "No active verification code found. Request a new one." },
        { status: 400 }
      );
    }

    // 2. Check retry attempts count
    if (user.otp_attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new verification code." },
        { status: 400 }
      );
    }

    // Increment attempts count
    const newAttempts = user.otp_attempts + 1;
    await supabaseAdmin
      .from("users")
      .update({ otp_attempts: newAttempts })
      .eq("id", user.id);

    // 3. Verify expiration
    const expiry = new Date(user.otp_expires_at).getTime();
    if (Date.now() > expiry) {
      return NextResponse.json(
        { error: "Verification code has expired. Request a new one." },
        { status: 400 }
      );
    }

    // 4. Compare OTP code
    if (user.otp_code !== otp.trim()) {
      const remaining = MAX_OTP_ATTEMPTS - newAttempts;
      return NextResponse.json(
        { error: `Invalid verification code. ${remaining} attempts remaining.` },
        { status: 400 }
      );
    }

    // 5. Successful validation - clear OTP fields and set email_verified to true
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        email_verified: true,
        otp_code: null,
        otp_expires_at: null,
        otp_attempts: 0,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("OTP success update error:", updateError);
      return NextResponse.json(
        { error: "Failed to finalize verification status" },
        { status: 500 }
      );
    }

    // Log the audit event
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "auth.verify_otp",
      metadata: { email: emailTrimmed },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      message: "Email verified successfully. You can now log into your account.",
    });
  } catch (error) {
    console.error("Verify OTP API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
