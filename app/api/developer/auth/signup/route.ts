import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { hashPassword } from "@/lib/server/password";
import { getClientIp } from "@/lib/server/developerAuth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, password" },
        { status: 400 }
      );
    }

    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email address format" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // 1. Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", emailTrimmed)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // 2. Hash password & generate OTP
    const passwordHash = hashPassword(password);
    // Generate a 6-digit random code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    // 3. Create the user
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        name: name.trim(),
        email: emailTrimmed,
        password_hash: passwordHash,
        otp_code: otpCode,
        otp_expires_at: otpExpiresAt,
        otp_attempts: 0,
        email_verified: false,
      })
      .select("id, name, email")
      .single();

    if (insertError || !newUser) {
      console.error("Signup insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 500 }
      );
    }

    // Log the action to audit_logs
    await supabaseAdmin.from("audit_logs").insert({
      user_id: newUser.id,
      action: "auth.signup",
      metadata: { email: emailTrimmed },
      ip_address: getClientIp(request),
    });

    // NOTE: Email service is not configured. The verification code is printed to the server logs
    // for developer testing.
    console.log(`[STUB EMAIL] Verification code for ${emailTrimmed}: ${otpCode}`);

    return NextResponse.json({
      success: true,
      message: "Registration successful. Please verify your email using the OTP sent to your inbox.",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Signup API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
