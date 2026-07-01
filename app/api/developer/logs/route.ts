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
    const endpoint = searchParams.get("endpoint");
    const method = searchParams.get("method");
    const statusCode = searchParams.get("statusCode");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("api_request_logs")
      .select("id, api_key_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent, created_at", { count: "exact" })
      .eq("user_id", user.id);

    if (apiKeyId) {
      query = query.eq("api_key_id", apiKeyId);
    }
    if (endpoint) {
      query = query.ilike("endpoint", `%${endpoint}%`);
    }
    if (method) {
      query = query.eq("method", method.toUpperCase());
    }
    if (statusCode) {
      query = query.eq("status_code", parseInt(statusCode, 10));
    }

    const { data: logs, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !logs) {
      console.error("Fetch request logs error:", error);
      return NextResponse.json({ error: "Failed to fetch request logs" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("GET request logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
