import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get("apiKeyId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = supabaseAdmin
      .from("api_usage")
      .select("id, api_key_id, endpoint, method, requests_count, created_at")
      .eq("user_id", user.id);

    if (apiKeyId) {
      query = query.eq("api_key_id", apiKeyId);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: usage, error } = await query.order("created_at", { ascending: true });

    if (error || !usage) {
      console.error("Fetch API usage error:", error);
      return NextResponse.json({ error: "Failed to fetch API usage statistics" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      usage,
    });
  } catch (error) {
    console.error("GET API usage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
