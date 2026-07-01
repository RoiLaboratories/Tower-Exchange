import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser } from "@/lib/server/developerAuth";

export async function GET(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get current user API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
