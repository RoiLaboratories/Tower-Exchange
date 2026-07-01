import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { verifyPassword } from "@/lib/server/password";
import { createSessionToken, sessionCookieOptions, getClientIp } from "@/lib/server/developerAuth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    const emailTrimmed = email.trim().toLowerCase();

    // 1. Fetch user profile
    const { data: user, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, name, email, password_hash, email_verified")
      .eq("email", emailTrimmed)
      .maybeSingle();

    if (fetchError || !user) {
      // Return a generic error to prevent email enumeration
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 2. Validate password
    const isPasswordCorrect = verifyPassword(password, user.password_hash);
    if (!isPasswordCorrect) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 3. Enforce email verification
    if (!user.email_verified) {
      return NextResponse.json(
        {
          error: "Your email address is not verified. Please verify your email before logging in.",
          unverified: true,
        },
        { status: 403 }
      );
    }

    // 4. Generate JWT session token
    const token = createSessionToken(user.id);

    // 5. Create response and set cookie
    const response = NextResponse.json({
      success: true,
      message: "Logged in successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

    response.cookies.set({
      name: sessionCookieOptions.name,
      value: token,
      httpOnly: sessionCookieOptions.httpOnly,
      secure: sessionCookieOptions.secure,
      path: sessionCookieOptions.path,
      maxAge: sessionCookieOptions.maxAge,
      sameSite: sessionCookieOptions.sameSite,
    });

    // Log the audit event
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "auth.login",
      metadata: { email: emailTrimmed },
      ip_address: getClientIp(request),
    });

    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
