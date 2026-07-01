import { NextRequest, NextResponse } from "next/server";
import { sessionCookieOptions, getDeveloperUser, getClientIp } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);

    // Create response
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    // Delete the session cookie by setting maxAge to 0
    response.cookies.set({
      name: sessionCookieOptions.name,
      value: "",
      httpOnly: sessionCookieOptions.httpOnly,
      secure: sessionCookieOptions.secure,
      path: sessionCookieOptions.path,
      maxAge: 0,
      sameSite: sessionCookieOptions.sameSite,
    });

    // Log the audit event if user was logged in
    if (user) {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: user.id,
        action: "auth.logout",
        metadata: { email: user.email },
        ip_address: getClientIp(request),
      });
    }

    return response;
  } catch (error) {
    console.error("Logout API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
