import { NextRequest, NextResponse } from "next/server";
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

    // 1. Fetch user
    const { data: user, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, email_verified, otp_expires_at, updated_at")
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

    // 2. Simple Rate Limit: Check if OTP was sent in the last 60 seconds
    if (user.otp_expires_at) {
      const expiresAt = new Date(user.otp_expires_at).getTime();
      const generatedAt = expiresAt - 15 * 60 * 1000; // 15 mins expiry
      const timeSinceLastOtp = Date.now() - generatedAt;

      if (timeSinceLastOtp < 60 * 1000) {
        const waitTime = Math.ceil((60 * 1000 - timeSinceLastOtp) / 1000);
        return NextResponse.json(
          { error: `Please wait ${waitTime} seconds before requesting another code.` },
          { status: 429 }
        );
      }
    }

    // 3. Generate new OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        otp_code: otpCode,
        otp_expires_at: otpExpiresAt,
        otp_attempts: 0,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Resend OTP update error:", updateError);
      return NextResponse.json(
        { error: "Failed to generate new OTP" },
        { status: 500 }
      );
    }

    // Log to audit logs
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "auth.resend_otp",
      metadata: { email: emailTrimmed },
      ip_address: getClientIp(request),
    });

    console.log(`[STUB EMAIL] Verification code resent for ${emailTrimmed}: ${otpCode}`);

    return NextResponse.json({
      success: true,
      message: "A new verification code has been generated and sent to your email.",
    });
  } catch (error) {
    console.error("Resend OTP API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
